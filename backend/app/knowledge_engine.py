import os
import json
import uuid
import datetime
import httpx
import re
import base64
from typing import List, Dict, Any, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KNOWLEDGE_FILE = os.path.join(BASE_DIR, "app", "knowledge_base.json")

def load_knowledge() -> List[Dict[str, Any]]:
    if not os.path.exists(KNOWLEDGE_FILE):
        return []
    try:
        with open(KNOWLEDGE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_knowledge(entries: List[Dict[str, Any]]):
    try:
        with open(KNOWLEDGE_FILE, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Error saving knowledge base:", e)

def add_knowledge_entry(user_id: str, title: str, content: str, type_name: str, related_module: Optional[str] = None, metadata: Optional[dict] = None) -> dict:
    entries = load_knowledge()
    
    # De-duplicate of same type/related_module to prevent bloat (except chat logs)
    if related_module and type_name not in ["chat"]:
        entries = [e for e in entries if not (e.get("user_id") == user_id and e.get("type") == type_name and e.get("related_module") == related_module)]
        
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "content": content,
        "type": type_name, # "chat", "pdf", "docx", "txt", "image", "note", "task", "reminder", "bookmark", "permanent"
        "related_module": related_module,
        "metadata": metadata or {},
        "created_at": datetime.datetime.now().isoformat()
    }
    entries.insert(0, entry)
    save_knowledge(entries)
    return entry

def delete_knowledge_by_keyword(user_id: str, keyword: str) -> bool:
    entries = load_knowledge()
    initial_len = len(entries)
    keyword_lower = keyword.lower()
    
    filtered = [
        e for e in entries 
        if not (e.get("user_id") == user_id and (keyword_lower in e.get("title", "").lower() or keyword_lower in e.get("content", "").lower()))
    ]
    if len(filtered) < initial_len:
        save_knowledge(filtered)
        return True
    return False

def tokenize(text: str) -> List[str]:
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    words = text.split()
    stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", "by", "of", "about", "this", "that", "these", "those", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did", "i", "you", "he", "she", "it", "we", "they"}
    return [w for w in words if w not in stopwords and len(w) > 1]

def search_relevant_knowledge(user_id: str, query: str, limit: int = 3) -> List[Dict[str, Any]]:
    entries = load_knowledge()
    user_entries = [e for e in entries if e.get("user_id") == user_id]
    if not user_entries or not query.strip():
        return []
        
    query_tokens = tokenize(query)
    if not query_tokens:
        return user_entries[:limit]
        
    scored_entries = []
    for entry in user_entries:
        score = 0
        content_lower = entry.get("content", "").lower()
        title_lower = entry.get("title", "").lower()
        type_name = entry.get("type", "")
        
        # Sentence overlap boost
        if query.lower() in content_lower:
            score += 15
        if query.lower() in title_lower:
            score += 30
            
        # Keyword matching TF-IDF approximations
        for token in query_tokens:
            tf_title = title_lower.count(token)
            score += tf_title * 8
            
            tf_content = content_lower.count(token)
            if tf_content > 0:
                score += (1 + tf_content ** 0.5) * 2
                
        if score > 0:
            # Memory Mode Priority Boost
            if type_name == "permanent":
                score *= 1.5
            elif type_name == "chat":
                score *= 0.8
                
            scored_entries.append((score, entry))
            
    scored_entries.sort(key=lambda x: x[0], reverse=True)
    results = [entry for score, entry in scored_entries if score >= 1.5]
    return results[:limit]

async def index_file_in_background(user_id: str, file_id: str, filename: str, file_type: str, file_bytes: bytes, gemini_api_key: str, gemini_model: str):
    success = False
    try:
        txt_extensions = [".txt", ".py", ".js", ".ts", ".java", ".cpp", ".html", ".css", ".json", ".md", ".yaml", ".yml", ".ini", ".conf"]
        
        if file_type in txt_extensions:
            content = file_bytes.decode("utf-8", errors="ignore")
            add_knowledge_entry(
                user_id=user_id,
                title=filename,
                content=content,
                type_name="txt",
                related_module=file_id,
                metadata={"filename": filename, "file_size": len(file_bytes), "file_type": file_type}
            )
            print(f"[KNOWLEDGE ENGINE] Indexed TXT file: {filename}")
            success = True
            
        elif file_type == ".docx":
            temp_path = os.path.join(BASE_DIR, "app", "temp_uploads", f"temp_{file_id}.docx")
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            with open(temp_path, "wb") as f:
                f.write(file_bytes)
            try:
                # Delayed import to avoid circular dependencies
                from app.main import extract_text_from_docx
                content = extract_text_from_docx(temp_path)
            except Exception as de:
                content = f"Error extracting docx: {de}"
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    
            add_knowledge_entry(
                user_id=user_id,
                title=filename,
                content=content,
                type_name="docx",
                related_module=file_id,
                metadata={"filename": filename, "file_size": len(file_bytes), "file_type": file_type}
            )
            print(f"[KNOWLEDGE ENGINE] Indexed DOCX file: {filename}")
            success = True
            
        elif file_type in [".pdf", ".png", ".jpg", ".jpeg", ".webp"]:
            if not gemini_api_key or gemini_api_key == "YOUR_GEMINI_API_KEY_HERE":
                print("[KNOWLEDGE ENGINE] Gemini API key not configured, skipping multimodal indexing")
                raise Exception("Gemini API key not configured")
                
            mime_types = {
                ".pdf": "application/pdf",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".webp": "image/webp"
            }
            mime_type = mime_types.get(file_type, "application/octet-stream")
            b64_data = base64.b64encode(file_bytes).decode("utf-8")
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_api_key}"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": b64_data
                                }
                            },
                            {
                                "text": "You are a document indexing engine. Extract all readable text, OCR content, objects, charts, tables, diagrams, and summaries from this file. Return only the extracted text and detailed structural summary for indexing in plain text format."
                            }
                        ]
                    }
                ]
            }
            
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    extracted_text = ""
                    try:
                        extracted_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    except:
                        extracted_text = "Failed to parse text from Gemini response."
                        
                    type_label = "pdf" if file_type == ".pdf" else "image"
                    add_knowledge_entry(
                        user_id=user_id,
                        title=filename,
                        content=extracted_text,
                        type_name=type_label,
                        related_module=file_id,
                        metadata={"filename": filename, "file_size": len(file_bytes), "file_type": file_type}
                    )
                    print(f"[KNOWLEDGE ENGINE] Multimodally indexed {file_type} file: {filename}")
                    success = True
                    
                    # Gemini multimodal is a background AI operation!
                    try:
                        from app.notifications import create_notification_internal
                        create_notification_internal(
                            user_id=user_id,
                            title="AI Task Completed 🧠",
                            message=f"Background AI indexing for '{filename}' is complete.",
                            type="background_ai"
                        )
                    except Exception as ne:
                        print("Failed to dispatch background AI notification:", ne)
                else:
                    print(f"[KNOWLEDGE ENGINE] Gemini file index request failed: {res.status_code} - {res.text}")
                    raise Exception(f"Gemini API returned status {res.status_code}")
                    
        # Send Document Notification if success
        if success:
            try:
                from app.notifications import create_notification_internal
                create_notification_internal(
                    user_id=user_id,
                    title="File Processed ✅",
                    message=f"Your file '{filename}' has finished processing.",
                    type="documents_files"
                )
                create_notification_internal(
                    user_id=user_id,
                    title="Document Analysis Completed 📊",
                    message=f"Document analysis completed for '{filename}'.",
                    type="documents_files"
                )
            except Exception as ne:
                print("Failed to dispatch document processed notification:", ne)
        else:
            raise Exception("Unsupported or failed file type indexing")
            
    except Exception as e:
        print(f"[KNOWLEDGE ENGINE] Exception indexing file {filename}: {e}")
        try:
            from app.notifications import create_notification_internal
            create_notification_internal(
                user_id=user_id,
                title="File Processing Failed ❌",
                message=f"Unable to process '{filename}'. Check details.",
                type="documents_files"
            )
            # Send background AI task failure notification if it's PDF/multimodal
            if file_type in [".pdf", ".png", ".jpg", ".jpeg", ".webp"]:
                create_notification_internal(
                    user_id=user_id,
                    title="AI Task Failed ⚠️",
                    message=f"Background AI indexing failed for '{filename}': {str(e)}",
                    type="background_ai"
                )
        except Exception as ne:
            print("Failed to dispatch failure notifications:", ne)
