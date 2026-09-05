from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Depends, Request, Body
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
import sys
import io
import asyncio

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import os
import uuid
import base64
import zipfile
import xml.etree.ElementTree as ET
import json
import datetime
import time
import requests
_http_session = requests.Session()
import bcrypt
import jwt
from typing import Optional, List
from app.core.config import settings
from app.database import (
    users_collection,
    chats_collection,
    subscriptions_collection,
    usages_collection,
    memories_collection,
    notes_collection,
    tasks_collection,
    reminders_collection,
    documents_collection,
    workflows_collection,
    workflow_history_collection,
    notifications_collection,
    notification_prefs_collection,
    preferences_collection,
    knowledge_collection,
    payments_collection,
    sub_config_collection,
    system_settings_collection,
    audit_logs_collection,
)
from app.tools import run_tool
from app.universal_router import normalize_nlu_message
from app.notifications import dispatch_subscription_event_notifications

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS configurations
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS if "*" not in str(origin) or str(origin) == "*"],
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Health Check Endpoint for Render / Vercel / Deployment Monitoring
@app.get("/api/health")
async def health_check():
    mongo_status = "disconnected"
    try:
        await users_collection.find_one({}, {"_id": 1})
        mongo_status = "connected"
    except Exception as e:
        mongo_status = f"error: {str(e)}"
    
    from app.services.ai_provider import global_health_tracker
    ai_health = global_health_tracker.get_status()

    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "database": mongo_status,
        "ai_primary_provider": settings.AI_PRIMARY_PROVIDER,
        "ai_fallback_configured": bool(settings.AI_FALLBACK_PROVIDER and settings.FALLBACK_API_KEY),
        "ai_health_status": ai_health,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

# --- MONGODB ATLAS ASYNC DATA HELPERS ---
async def db_load_users() -> list:
    try:
        cursor = users_collection.find({}, {"_id": 0})
        users = await cursor.to_list(length=None)
        if users:
            return users
    except Exception as e:
        print("[MongoDB db_load_users error]:", e)
    return load_users()

async def db_find_user_by_id(user_id: str) -> Optional[dict]:
    try:
        user = await users_collection.find_one({"id": user_id}, {"_id": 0})
        if user:
            return user
    except Exception as e:
        print("[MongoDB db_find_user_by_id error]:", e)
    for u in load_users():
        if u.get("id") == user_id:
            return u
    return None

async def db_find_user_by_email(email: str) -> Optional[dict]:
    clean_email = email.lower().strip()
    try:
        user = await users_collection.find_one({"email": clean_email}, {"_id": 0})
        if user:
            return user
    except Exception as e:
        print("[MongoDB db_find_user_by_email error]:", e)
    for u in load_users():
        if u.get("email", "").lower().strip() == clean_email:
            return u
    return None

async def db_save_user(user_doc: dict):
    user_id = user_doc.get("id")
    if not user_id:
        return
    try:
        clean_doc = {k: v for k, v in user_doc.items() if k != "_id"}
        await users_collection.update_one({"id": user_id}, {"$set": clean_doc}, upsert=True)
    except Exception as e:
        print("[MongoDB db_save_user error]:", e)
    try:
        users = load_users()
        idx = next((i for i, u in enumerate(users) if u["id"] == user_id), -1)
        if idx >= 0:
            users[idx] = {k: v for k, v in user_doc.items() if k != "_id"}
        else:
            users.insert(0, {k: v for k, v in user_doc.items() if k != "_id"})
        save_users(users)
    except Exception:
        pass

async def db_load_chats_for_user(user_id: str) -> list:
    try:
        cursor = chats_collection.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
        chats = await cursor.to_list(length=None)
        if chats:
            return chats
    except Exception as e:
        print("[MongoDB db_load_chats_for_user error]:", e)
    return [c for c in load_chats() if c.get("user_id") == user_id]

async def db_load_chat_by_id(chat_id: str, user_id: str) -> Optional[dict]:
    try:
        chat = await chats_collection.find_one({"id": chat_id, "user_id": user_id}, {"_id": 0})
        if chat:
            return chat
    except Exception as e:
        print("[MongoDB db_load_chat_by_id error]:", e)
    for c in load_chats():
        if c.get("id") == chat_id and c.get("user_id") == user_id:
            return c
    return None

async def db_save_chat(chat_doc: dict):
    chat_id = chat_doc.get("id")
    if not chat_id:
        return
    try:
        clean_doc = {k: v for k, v in chat_doc.items() if k != "_id"}
        await chats_collection.update_one({"id": chat_id}, {"$set": clean_doc}, upsert=True)
    except Exception as e:
        print("[MongoDB db_save_chat error]:", e)
    try:
        chats = load_chats()
        idx = next((i for i, c in enumerate(chats) if c["id"] == chat_id), -1)
        if idx >= 0:
            chats[idx] = {k: v for k, v in chat_doc.items() if k != "_id"}
        else:
            chats.insert(0, {k: v for k, v in chat_doc.items() if k != "_id"})
        save_chats(chats)
    except Exception:
        pass

async def db_delete_chat(chat_id: str, user_id: str) -> bool:
    deleted = False
    try:
        res = await chats_collection.delete_one({"id": chat_id, "user_id": user_id})
        if res.deleted_count > 0:
            deleted = True
    except Exception as e:
        print("[MongoDB db_delete_chat error]:", e)
    try:
        chats = load_chats()
        filtered = [c for c in chats if not (c.get("id") == chat_id and c.get("user_id") == user_id)]
        if len(filtered) < len(chats):
            save_chats(filtered)
            deleted = True
    except Exception:
        pass
    return deleted

async def db_load_notes_for_user(user_id: str) -> list:
    try:
        cursor = notes_collection.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
        notes = await cursor.to_list(length=None)
        if notes:
            return notes
    except Exception as e:
        print("[MongoDB db_load_notes_for_user error]:", e)
    return [n for n in load_notes() if n.get("user_id") == user_id]

async def db_save_note(note_doc: dict):
    note_id = note_doc.get("id")
    if not note_id:
        return
    try:
        clean_doc = {k: v for k, v in note_doc.items() if k != "_id"}
        await notes_collection.update_one({"id": note_id}, {"$set": clean_doc}, upsert=True)
    except Exception as e:
        print("[MongoDB db_save_note error]:", e)
    try:
        notes = load_notes()
        idx = next((i for i, n in enumerate(notes) if n.get("id") == note_id), -1)
        if idx >= 0:
            notes[idx] = {k: v for k, v in note_doc.items() if k != "_id"}
        else:
            notes.insert(0, {k: v for k, v in note_doc.items() if k != "_id"})
        save_notes(notes)
    except Exception:
        pass

async def db_delete_note(note_id: str, user_id: str) -> bool:
    try:
        res = await notes_collection.delete_one({"id": note_id, "user_id": user_id})
        if res.deleted_count > 0:
            return True
    except Exception as e:
        print("[MongoDB db_delete_note error]:", e)
    notes = load_notes()
    filtered = [n for n in notes if not (n.get("id") == note_id and n.get("user_id") == user_id)]
    if len(filtered) < len(notes):
        save_notes(filtered)
        return True
    return False

async def db_load_tasks_for_user(user_id: str) -> list:
    try:
        cursor = tasks_collection.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
        tasks = await cursor.to_list(length=None)
        if tasks:
            return tasks
    except Exception as e:
        print("[MongoDB db_load_tasks_for_user error]:", e)
    return [t for t in load_tasks() if t.get("user_id") == user_id]

async def db_save_task(task_doc: dict):
    task_id = task_doc.get("id")
    if not task_id:
        return
    try:
        clean_doc = {k: v for k, v in task_doc.items() if k != "_id"}
        await tasks_collection.update_one({"id": task_id}, {"$set": clean_doc}, upsert=True)
    except Exception as e:
        print("[MongoDB db_save_task error]:", e)
    try:
        tasks = load_tasks()
        idx = next((i for i, t in enumerate(tasks) if t.get("id") == task_id), -1)
        if idx >= 0:
            tasks[idx] = {k: v for k, v in task_doc.items() if k != "_id"}
        else:
            tasks.insert(0, {k: v for k, v in task_doc.items() if k != "_id"})
        save_tasks(tasks)
    except Exception:
        pass

async def db_delete_task(task_id: str, user_id: str) -> bool:
    try:
        res = await tasks_collection.delete_one({"id": task_id, "user_id": user_id})
        if res.deleted_count > 0:
            return True
    except Exception as e:
        print("[MongoDB db_delete_task error]:", e)
    tasks = load_tasks()
    filtered = [t for t in tasks if not (t.get("id") == task_id and t.get("user_id") == user_id)]
    if len(filtered) < len(tasks):
        save_tasks(filtered)
        return True
    return False

async def db_load_reminders_for_user(user_id: str) -> list:
    try:
        cursor = reminders_collection.find({"user_id": user_id}, {"_id": 0}).sort("datetime", 1)
        reminders = await cursor.to_list(length=None)
        if reminders:
            return reminders
    except Exception as e:
        print("[MongoDB db_load_reminders_for_user error]:", e)
    return [r for r in load_reminders() if r.get("user_id") == user_id]

async def db_save_reminder(reminder_doc: dict):
    rem_id = reminder_doc.get("id")
    if not rem_id:
        return
    try:
        clean_doc = {k: v for k, v in reminder_doc.items() if k != "_id"}
        await reminders_collection.update_one({"id": rem_id}, {"$set": clean_doc}, upsert=True)
    except Exception as e:
        print("[MongoDB db_save_reminder error]:", e)
    try:
        reminders = load_reminders()
        idx = next((i for i, r in enumerate(reminders) if r.get("id") == rem_id), -1)
        if idx >= 0:
            reminders[idx] = {k: v for k, v in reminder_doc.items() if k != "_id"}
        else:
            reminders.insert(0, {k: v for k, v in reminder_doc.items() if k != "_id"})
        save_reminders(reminders)
    except Exception:
        pass

async def db_delete_reminder(reminder_id: str, user_id: str) -> bool:
    try:
        res = await reminders_collection.delete_one({"id": reminder_id, "user_id": user_id})
        if res.deleted_count > 0:
            return True
    except Exception as e:
        print("[MongoDB db_delete_reminder error]:", e)
    reminders = load_reminders()
    filtered = [r for r in reminders if not (r.get("id") == reminder_id and r.get("user_id") == user_id)]
    if len(filtered) < len(reminders):
        save_reminders(filtered)
        return True
    return False

async def db_load_memories_for_user(user_id: str) -> list:
    try:
        cursor = memories_collection.find({"user_id": user_id}, {"_id": 0}).sort("timestamp", -1)
        memories = await cursor.to_list(length=None)
        if memories:
            return memories
    except Exception as e:
        print("[MongoDB db_load_memories_for_user error]:", e)
    return [m for m in load_memories() if m.get("user_id") == user_id]

async def db_save_memory(memory_doc: dict):
    mem_id = memory_doc.get("id")
    if not mem_id:
        return
    try:
        clean_doc = {k: v for k, v in memory_doc.items() if k != "_id"}
        await memories_collection.update_one({"id": mem_id}, {"$set": clean_doc}, upsert=True)
    except Exception as e:
        print("[MongoDB db_save_memory error]:", e)
    try:
        memories = load_memories()
        idx = next((i for i, m in enumerate(memories) if m.get("id") == mem_id), -1)
        if idx >= 0:
            memories[idx] = {k: v for k, v in memory_doc.items() if k != "_id"}
        else:
            memories.insert(0, {k: v for k, v in memory_doc.items() if k != "_id"})
        save_memories(memories)
    except Exception:
        pass

async def db_delete_memory(memory_id: str, user_id: str) -> bool:
    try:
        res = await memories_collection.delete_one({"id": memory_id, "user_id": user_id})
        if res.deleted_count > 0:
            return True
    except Exception as e:
        print("[MongoDB db_delete_memory error]:", e)
    memories = load_memories()
    filtered = [m for m in memories if not (m.get("id") == memory_id and m.get("user_id") == user_id)]
    if len(filtered) < len(memories):
        save_memories(filtered)
        return True
    return False

class ChatRequest(BaseModel):

    chat_id: str
    message: str = ""
    file: Optional[dict] = None
    web_search: Optional[bool] = False

class CreateChatRequest(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = "New Chat"

class RenameChatRequest(BaseModel):
    title: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    email: str
    name: str
    google_id: str
    avatar: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class SaveMemoryRequest(BaseModel):
    content: str

class ImageGenerateRequest(BaseModel):
    chat_id: str
    prompt: str

class ImageAnalyzeRequest(BaseModel):
    image_base64: str
    prompt: Optional[str] = None

@app.get("/api/health")
def health_check():
    return {"status": "Backend Running"}




# Resolve paths relative to main.py location
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMP_UPLOAD_DIR = os.path.join(BASE_DIR, "app", "temp_uploads")
os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)

# Ensure static directories exist and mount
STATIC_DIR = os.path.join(BASE_DIR, "app", "static")
IMAGES_DIR = os.path.join(STATIC_DIR, "generated_images")
os.makedirs(IMAGES_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

from app.documents import router as documents_router
app.include_router(documents_router)
from app.automation import router as automation_router
app.include_router(automation_router)
from app.notifications import router as notifications_router
app.include_router(notifications_router)

# User Database File
USERS_FILE = os.path.join(BASE_DIR, "app", "users.json")

# Chat History File Storage
CHATS_FILE = os.path.join(BASE_DIR, "app", "chats.json")

# JWT configuration
SECRET_KEY = "SUPER_SECRET_KEY_JWT_TOKEN_MEGA_ASSISTANT_123!"
ALGORITHM = "HS256"

def normalize_plan(raw_plan: Optional[str]) -> str:
    if not raw_plan:
        return "FREE"
    p = raw_plan.strip().upper()
    if p in ["FREE", "FREE PLAN", "FREE TIER"]:
        return "FREE"
    if p in ["PLUS", "MEGA PLUS"]:
        return "PLUS"
    if p in ["PRO", "PRO PLAN", "MEGA PRO"]:
        return "PRO"
    if "PRO" in p:
        return "PRO"
    if "PLUS" in p:
        return "PLUS"
    return "FREE"

SUBSCRIPTIONS_FILE = os.path.join(BASE_DIR, "app", "subscriptions.json")
subscriptions_lock = asyncio.Lock()

def load_subscriptions_sync() -> list:
    if not os.path.exists(SUBSCRIPTIONS_FILE):
        return []
    try:
        with open(SUBSCRIPTIONS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print("Failed to load subscriptions:", e)
        return []

def save_subscriptions_sync(subs: list):
    try:
        with open(SUBSCRIPTIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(subs, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save subscriptions:", e)

async def load_subscriptions() -> list:
    async with subscriptions_lock:
        return load_subscriptions_sync()

async def save_subscriptions(subs: list):
    async with subscriptions_lock:
        save_subscriptions_sync(subs)

def get_user_subscription_info(user_id: str) -> dict:
    subscriptions = load_subscriptions_sync()
    now_str = datetime.datetime.utcnow().isoformat() + "Z"

    active_subs = [
        s for s in subscriptions
        if s["user_id"] == user_id
        and s["status"] in ["ACTIVE", "CANCELLED"]
    ]

    if active_subs:
        # Sort by newest created_at
        newest = sorted(active_subs, key=lambda x: x.get("created_at", ""), reverse=True)[0]
        next_billing = newest.get("next_billing_date")

        # 1. Process scheduled change if due
        sched = newest.get("scheduled_change")
        if sched and sched.get("effective_date") and now_str >= sched["effective_date"]:
            new_plan = sched["plan_id"]
            newest["plan_id"] = new_plan
            newest["plan_name"] = "Mega Plus" if new_plan == "PLUS" else "Mega Pro"
            newest["scheduled_change"] = None
            newest["next_billing_date"] = (datetime.datetime.utcnow() + datetime.timedelta(days=30)).isoformat() + "Z"
            newest["updated_at"] = now_str
            save_subscriptions_sync(subscriptions)
            
            # Sync user account_type
            users = load_users()
            for u in users:
                if u["id"] == user_id:
                    u["account_type"] = new_plan
                    save_users(users)
                    break
            
            try:
                from app.notifications import create_notification_internal
                create_notification_internal(
                    user_id=user_id,
                    title="Plan Switched 🎉",
                    message=f"Your scheduled change is now active on '{new_plan}'.",
                    type="plan_billing",
                    priority="normal"
                )
            except Exception:
                pass
                
            return {
                "plan_id": new_plan,
                "status": newest["status"],
                "billing_cycle": "Monthly",
                "next_billing_date": newest["next_billing_date"],
                "cancelled_at": newest.get("cancelled_at"),
                "provider": newest.get("provider"),
                "subscription_id": newest.get("provider_subscription_id") or newest.get("provider_order_id"),
                "scheduled_change": None
            }

        # 2. Check if expired
        if next_billing and now_str > next_billing:
            newest["status"] = "EXPIRED"
            newest["updated_at"] = now_str
            save_subscriptions_sync(subscriptions)
            
            users = load_users()
            for u in users:
                if u["id"] == user_id:
                    u["account_type"] = "FREE"
                    save_users(users)
                    break
            
            try:
                from app.notifications import create_notification_internal
                create_notification_internal(
                    user_id=user_id,
                    title="Plan Expired ⚠️",
                    message="Your subscription has ended and reverted to the Free tier.",
                    type="plan_billing",
                    priority="normal"
                )
            except Exception:
                pass

            return {
                "plan_id": "FREE",
                "status": "EXPIRED",
                "billing_cycle": "N/A",
                "next_billing_date": "N/A",
                "cancelled_at": newest.get("cancelled_at"),
                "provider": newest.get("provider"),
                "subscription_id": newest.get("provider_subscription_id") or newest.get("provider_order_id"),
                "scheduled_change": None
            }

        return {
            "plan_id": newest["plan_id"],
            "status": newest["status"],
            "billing_cycle": "Monthly",
            "next_billing_date": next_billing or "N/A",
            "cancelled_at": newest.get("cancelled_at"),
            "provider": newest.get("provider"),
            "subscription_id": newest.get("provider_subscription_id") or newest.get("provider_order_id"),
            "scheduled_change": newest.get("scheduled_change")
        }
        
    return {
        "plan_id": "FREE",
        "status": "FREE",
        "billing_cycle": "N/A",
        "next_billing_date": "N/A",
        "cancelled_at": None,
        "provider": None,
        "subscription_id": None,
        "scheduled_change": None
    }

def get_user_active_plan(user_id: str) -> str:
    sub_info = get_user_subscription_info(user_id)
    if sub_info["status"] not in ["FREE", "EXPIRED", "FAILED"]:
        return sub_info["plan_id"]
        
    # Fallback to users.json
    users = load_users()
    for u in users:
        if u["id"] == user_id:
            return normalize_plan(u.get("account_type", "FREE"))
    return "FREE"

def get_user_plan(user_id: str) -> str:
    return get_user_active_plan(user_id).upper()

def has_plan_access(user_id: str, required_plan: str) -> bool:
    hierarchy = {"FREE": 0, "GO": 1, "PLUS": 2, "PRO": 3}
    user_plan = get_user_plan(user_id)
    user_rank = hierarchy.get(user_plan, 0)
    req_rank = hierarchy.get(required_plan.upper(), 0)
    return user_rank >= req_rank

# User Data Loaders
def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_users(users):
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save users:", e)
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            async def _sync():
                for u in users:
                    if u.get("id"):
                        doc = {k: v for k, v in u.items() if k != "_id"}
                        await users_collection.update_one({"id": u["id"]}, {"$set": doc}, upsert=True)
            loop.create_task(_sync())
    except Exception:
        pass

# User Usage File Storage
USAGES_FILE = os.path.join(BASE_DIR, "app", "usage.json")
usage_lock = asyncio.Lock()

LIMITS_CONFIG = {
    "FREE": {
        "photo_upload": 10,
        "file_upload": 5,
        "image_generation": 3
    },
    "PLUS": {
        "photo_upload": 30,
        "file_upload": 20,
        "image_generation": 15
    },
    "PRO": {
        "photo_upload": 100,
        "file_upload": 50,
        "image_generation": 50
    }
}

def load_usages():
    if not os.path.exists(USAGES_FILE):
        return []
    try:
        with open(USAGES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_usages(usages):
    try:
        with open(USAGES_FILE, "w", encoding="utf-8") as f:
            json.dump(usages, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save usages:", e)

def get_plan_details(plan: str) -> dict:
    plan = plan.upper()
    plans_file = os.path.join(BASE_DIR, "app", "plans.json")
    if os.path.exists(plans_file):
        try:
            with open(plans_file, "r", encoding="utf-8") as f:
                plans = json.load(f)
                for p in plans:
                    if p.get("id") == plan:
                        return p
        except Exception:
            pass
    return {}

def get_plan_max_file_size(plan: str) -> int:
    try:
        p_details = get_plan_details(plan)
        if p_details:
            limits = p_details.get("limits", {})
            max_size_mb = limits.get("max_file_size")
            if max_size_mb is not None:
                if int(max_size_mb) == -1:
                    return 99999 * 1024 * 1024
                return int(max_size_mb) * 1024 * 1024
    except Exception:
        pass
    return 20 * 1024 * 1024

def get_plan_limit(plan: str, usage_type: str) -> int:
    plan = plan.upper()
    settings_file = os.path.join(BASE_DIR, "app", "system_settings.json")
    if os.path.exists(settings_file):
        try:
            with open(settings_file, "r", encoding="utf-8") as f:
                settings = json.load(f)
                custom_limits = settings.get("plan_limits")
                if custom_limits and plan in custom_limits and usage_type in custom_limits[plan]:
                    return int(custom_limits[plan][usage_type])
        except Exception:
            pass
    return LIMITS_CONFIG.get(plan, LIMITS_CONFIG["FREE"]).get(usage_type, 0)


# Password Hashing Helpers
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

# JWT Helpers
def create_access_token(user_id: str, email: str, name: str, role: str = "user") -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=1440) # 24 hours
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication credentials were not provided.")
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token or expired session.")
    return payload

# Chat Data Loaders
def load_chats():
    if not os.path.exists(CHATS_FILE):
        return []
    try:
        with open(CHATS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_chats(chats):
    try:
        with open(CHATS_FILE, "w", encoding="utf-8") as f:
            json.dump(chats, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save chats:", e)
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            async def _sync():
                for c in chats:
                    if c.get("id"):
                        doc = {k: v for k, v in c.items() if k != "_id"}
                        await chats_collection.update_one({"id": c["id"]}, {"$set": doc}, upsert=True)
            loop.create_task(_sync())
    except Exception:
        pass

# Memory File Storage
MEMORIES_FILE = os.path.join(BASE_DIR, "app", "memories.json")

def load_memories():
    if not os.path.exists(MEMORIES_FILE):
        return []
    try:
        with open(MEMORIES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_memories(memories):
    try:
        with open(MEMORIES_FILE, "w", encoding="utf-8") as f:
            json.dump(memories, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save memories:", e)
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            async def _sync():
                for m in memories:
                    if m.get("id"):
                        doc = {k: v for k, v in m.items() if k != "_id"}
                        await memories_collection.update_one({"id": m["id"]}, {"$set": doc}, upsert=True)
            loop.create_task(_sync())
    except Exception:
        pass

ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".webp",
    ".py", ".js", ".ts", ".java", ".cpp", ".html", ".css", ".json"
}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

def extract_text_from_docx(filepath: str) -> str:
    try:
        with zipfile.ZipFile(filepath) as docx:
            xml_content = docx.read('word/document.xml')
            root = ET.fromstring(xml_content)
            paragraphs = []
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            for p in root.findall('.//w:p', ns):
                texts = [t.text for t in p.findall('.//w:t', ns) if t.text]
                if texts:
                    paragraphs.append("".join(texts))
            return "\n".join(paragraphs)
    except Exception as e:
        return f"Error extracting text from DOCX document: {e}"

# Auth Endpoints
@app.post("/api/auth/register")
async def register_endpoint(req: RegisterRequest):
    name = req.name.strip()
    email = req.email.strip().lower()
    password = req.password

    if not name or not email or not password:
        raise HTTPException(status_code=400, detail="Name, email, and password are required.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email format.")

    existing = await db_find_user_by_email(email)
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    user_id = f"user-{str(uuid.uuid4())}"
    new_user = {
        "id": user_id,
        "name": name,
        "email": email,
        "password_hash": hash_password(password),
        "role": "user",
        "account_type": "FREE",
        "member_since": datetime.date.today().isoformat()
    }
    await db_save_user(new_user)

    try:
        from app.notifications import create_notification_internal
        create_notification_internal(
            user_id=user_id,
            title="Email Verification 📧",
            message="Please verify your email address.",
            type="account_security",
            priority="normal"
        )
        create_notification_internal(
            user_id=user_id,
            title="Welcome to AI Mega Assistant! 🎉",
            message="Mega Assistant v2.0 is now live. Read our updates guide.",
            type="assistant_updates",
            priority="normal"
        )
    except Exception as ne:
        print("Failed to dispatch registration notifications:", ne)

    token = create_access_token(user_id, email, name, role="user")
    return {
        "token": token,
        "id": user_id,
        "name": name,
        "email": email,
        "avatar": "",
        "google_linked": False,
        "role": "user",
        "account_type": "FREE"
    }

@app.post("/api/auth/login")
async def login_endpoint(req: LoginRequest):
    email = req.email.strip().lower()
    password = req.password

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    print(f"[DIAGNOSTIC] Login request: normalized_email={email}")
    target_user = await db_find_user_by_email(email)

    user_found = target_user is not None
    pw_verified = False
    user_role = None
    account_type = None
    if user_found:
        pw_verified = verify_password(password, target_user["password_hash"])
        user_role = target_user.get("role")
        account_type = target_user.get("account_type")
        
    print(f"[DIAGNOSTIC] Login result: user_found={user_found}, pw_verified={pw_verified}, role={user_role}, account_type={account_type}")

    if not target_user or not pw_verified:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    try:
        from app.notifications import create_notification_internal
        create_notification_internal(
            user_id=target_user["id"],
            title="New Login Detected 🛡️",
            message="New login detected on your account.",
            type="account_security",
            priority="important"
        )
    except Exception as ne:
        print("Failed to dispatch login notification:", ne)

    user_role = target_user.get("role", "user")
    token = create_access_token(target_user["id"], target_user["email"], target_user["name"], role=user_role)
    return {
        "token": token,
        "id": target_user["id"],
        "name": target_user["name"],
        "email": target_user["email"],
        "avatar": target_user.get("avatar", ""),
        "google_linked": "google_id" in target_user and bool(target_user["google_id"]),
        "role": user_role,
        "account_type": get_user_active_plan(target_user["id"])
    }

@app.post("/api/auth/logout")
def logout_endpoint():
    return {"status": "success"}

@app.post("/api/auth/google")
async def google_login_endpoint(req: GoogleLoginRequest):
    email = req.email.strip().lower()
    name = req.name.strip()
    google_id = req.google_id
    avatar = req.avatar

    if not email or not name or not google_id:
        raise HTTPException(status_code=400, detail="Missing required Google account parameters.")

    target_user = await db_find_user_by_email(email)

    if target_user:
        target_user["google_id"] = google_id
        if avatar and not target_user.get("avatar"):
            target_user["avatar"] = avatar
        await db_save_user(target_user)
    else:
        user_id = f"user-{str(uuid.uuid4())}"
        target_user = {
            "id": user_id,
            "name": name,
            "email": email,
            "password_hash": "",
            "google_id": google_id,
            "avatar": avatar or "",
            "role": "user",
            "account_type": "FREE",
            "member_since": datetime.date.today().isoformat()
        }
        await db_save_user(target_user)

    user_role = target_user.get("role", "user")
    token = create_access_token(target_user["id"], target_user["email"], target_user["name"], role=user_role)
    return {
        "token": token,
        "id": target_user["id"],
        "name": target_user["name"],
        "email": target_user["email"],
        "avatar": target_user.get("avatar", ""),
        "google_linked": True,
        "role": user_role,
        "account_type": get_user_active_plan(target_user["id"])
    }

PLANS_CONFIG = [
    {
        "id": "FREE",
        "name": "Free",
        "price_display": "₹0",
        "price_numeric": 0,
        "billing": "monthly",
        "title": "Get started with AI Mega Assistant",
        "description": "Explore AI assistance for everyday questions, learning, coding and productivity.",
        "features": [
            "Core AI model",
            "Limited messages and uploads",
            "Limited image creation",
            "Basic memory",
            "Basic AI tools",
            "Standard response speed"
        ]
    },
    {
        "id": "PLUS",
        "name": "AI Mega Assistant Plus",
        "price_display": "₹0",
        "original_price_display": "₹899",
        "price_numeric": 0,
        "original_price_numeric": 899,
        "billing": "monthly",
        "promotion_duration": "1 month",
        "title": "Your advanced AI assistant",
        "description": "Unlock advanced intelligence for coding, research, creativity and productivity.",
        "features": [
            "Advanced AI models",
            "Advanced image creation",
            "Thinking / reasoning mode",
            "Expanded memory",
            "Deep research",
            "AI coding assistance",
            "AI workflow automation",
            "Projects",
            "Custom AI assistants",
            "Higher file and image limits",
            "Priority processing"
        ],
        "badge": "LIMITED TIME",
        "promotion_details": "Promo pricing applies for 1 month. After the promotional period, Plus continues at ₹899/month. Cancel anytime."
    }
]

class SelectPlanRequest(BaseModel):
    plan_id: str

class CheckoutRequest(BaseModel):
    plan_id: str
    billing_cycle: str
    payment_method: str
    is_promo: Optional[bool] = False

SUBSCRIPTION_CONFIG_FILE = os.path.join(BASE_DIR, "app", "subscription_config.json")

def load_subscription_config() -> dict:
    default_config = {
        "plan_name": "AI Mega Assistant Plus",
        "monthly_price": 899,
        "trial_enabled": True,
        "trial_duration": "1 month",
        "promo_price": 0,
        "offer_heading": "TRY PLUS FREE FOR 1 MONTH",
        "offer_description": "Experience advanced AI features with our limited-time Plus offer.",
        "after_trial_price": "₹899/month",
        "features": [
            "Advanced AI models",
            "Advanced image creation",
            "Thinking / reasoning mode",
            "Expanded memory",
            "Deep research",
            "AI coding assistance",
            "AI workflow automation",
            "Projects",
            "Custom AI assistants",
            "Higher file and image limits",
            "Priority processing"
        ],
        "offer_active": True,
        "updated_at": "",
        "updated_by": ""
    }
    if not os.path.exists(SUBSCRIPTION_CONFIG_FILE):
        try:
            with open(SUBSCRIPTION_CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(default_config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print("Failed to save default subscription config:", e)
        return default_config
    try:
        with open(SUBSCRIPTION_CONFIG_FILE, "r", encoding="utf-8") as f:
            config = json.load(f)
            # Ensure all keys exist
            for k, v in default_config.items():
                if k not in config:
                    config[k] = v
            return config
    except Exception as e:
        print("Failed to load subscription config, using default:", e)
        return default_config

def save_subscription_config(config: dict):
    try:
        with open(SUBSCRIPTION_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save subscription config:", e)

def calculate_trial_end(start_dt: datetime.datetime, duration_str: str) -> datetime.datetime:
    import re
    duration_str = duration_str.lower().strip()
    try:
        if "day" in duration_str:
            days = int(re.search(r'\d+', duration_str).group())
            return start_dt + datetime.timedelta(days=days)
        elif "month" in duration_str:
            months = int(re.search(r'\d+', duration_str).group())
            return start_dt + datetime.timedelta(days=months * 30)
        elif "week" in duration_str:
            weeks = int(re.search(r'\d+', duration_str).group())
            return start_dt + datetime.timedelta(days=weeks * 7)
    except Exception as e:
        print("Error parsing trial duration, using default 30 days:", e)
    return start_dt + datetime.timedelta(days=30)

@app.get("/api/subscription/plans")
async def get_subscription_plans():
    import copy
    config = load_subscription_config()
    configs = copy.deepcopy(PLANS_CONFIG)
    for plan in configs:
        if plan["id"] == "PLUS":
            plan["name"] = config["plan_name"]
            plan["features"] = config["features"]
            if config["offer_active"] and config["trial_enabled"]:
                plan["price_display"] = f"₹{config['promo_price']}"
                plan["price_numeric"] = config["promo_price"]
                plan["original_price_display"] = f"₹{config['monthly_price']}"
                plan["original_price_numeric"] = config["monthly_price"]
                plan["promotion_duration"] = config["trial_duration"]
                plan["badge"] = "LIMITED TIME"
                plan["promotion_details"] = f"{config['offer_heading']}. {config['offer_description']} After the promotional period, Plus continues at {config['after_trial_price']}. Cancel anytime."
            else:
                plan["price_display"] = f"₹{config['monthly_price']}"
                plan["price_numeric"] = config["monthly_price"]
                plan.pop("original_price_display", None)
                plan.pop("original_price_numeric", None)
                plan.pop("badge", None)
                plan.pop("promotion_details", None)
    return configs

def check_and_update_subscription_sync(latest, subscriptions, user_entry, users, now_str) -> bool:
    if latest["status"].upper() in ["ACTIVE", "TRIALING"] and latest.get("subscription_end") and now_str > latest["subscription_end"]:
        if latest.get("cancel_at_period_end"):
            latest["status"] = "EXPIRED"
            latest["updated_at"] = now_str
            if user_entry:
                user_entry["account_type"] = "FREE"
                save_users(users)
            return True
        else:
            try:
                end_str = latest["subscription_end"].rstrip("Z")
                end_dt = datetime.datetime.fromisoformat(end_str)
                new_end = (end_dt + datetime.timedelta(days=30)).isoformat() + "Z"
                latest["subscription_end"] = new_end
                latest["updated_at"] = now_str
                return True
            except Exception as e:
                print("Error renewing subscription:", e)
    return False

@app.get("/api/subscription/current")
async def get_current_subscription(authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(authorization)
    user_id = current_user["sub"]
    subscriptions = await load_subscriptions()
    user_subs = [s for s in subscriptions if s["user_id"] == user_id]
    
    users = load_users()
    user_entry = next((u for u in users if u["id"] == user_id), None)
    promotion_claimed = user_entry.get("promotion_claimed", False) if user_entry else False
    
    if user_subs:
        latest = sorted(user_subs, key=lambda x: x.get("created_at", ""), reverse=True)[0]
        now_str = datetime.datetime.utcnow().isoformat() + "Z"
        
        if check_and_update_subscription_sync(latest, subscriptions, user_entry, users, now_str):
            await save_subscriptions(subscriptions)
            
        if latest["status"].upper() == "EXPIRED":
            return {
                "current_plan": "free",
                "subscription_status": "expired",
                "billing_cycle": "monthly",
                "trial_start": latest.get("trial_start"),
                "trial_end": latest.get("trial_end"),
                "subscription_start": latest.get("subscription_start"),
                "subscription_end": latest.get("subscription_end"),
                "cancel_at_period_end": latest.get("cancel_at_period_end", False),
                "cancelled_at": latest.get("cancelled_at"),
                "promotion_claimed": promotion_claimed
            }
            
        return {
            "current_plan": latest["plan_id"].lower(),
            "subscription_status": latest["status"].lower(),
            "billing_cycle": latest.get("billing_cycle", "monthly"),
            "trial_start": latest.get("trial_start"),
            "trial_end": latest.get("trial_end"),
            "subscription_start": latest.get("subscription_start"),
            "subscription_end": latest.get("subscription_end"),
            "cancel_at_period_end": latest.get("cancel_at_period_end", False),
            "cancelled_at": latest.get("cancelled_at"),
            "promotion_claimed": promotion_claimed
        }
        
    account_type = user_entry.get("account_type", "FREE").lower() if user_entry else "free"
    return {
        "current_plan": account_type,
        "subscription_status": "active" if account_type != "free" else "free",
        "billing_cycle": "monthly",
        "trial_start": None,
        "trial_end": None,
        "subscription_start": None,
        "subscription_end": None,
        "cancel_at_period_end": False,
        "cancelled_at": None,
        "promotion_claimed": promotion_claimed
    }

@app.post("/api/subscription/select-plan")
async def select_plan(req: SelectPlanRequest, authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(authorization)
    plan_id = req.plan_id.upper()
    if plan_id not in ["FREE", "PLUS"]:
        raise HTTPException(status_code=400, detail="Invalid plan ID.")
        
    user_id = current_user["sub"]
    current_plan = get_user_plan(user_id)
    if current_plan == plan_id:
        raise HTTPException(status_code=400, detail="User already has selected plan.")
        
    # Load and append subscription
    subscriptions = await load_subscriptions()
    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    end_str = (datetime.datetime.utcnow() + datetime.timedelta(days=30)).isoformat() + "Z"
    
    users = load_users()
    user_entry = next((u for u in users if u["id"] == user_id), None)
    promotion_claimed = user_entry.get("promotion_claimed", False) if user_entry else False
    
    sub_id = f"sub_{uuid.uuid4().hex[:12]}"
    new_sub = {
        "id": sub_id,
        "user_id": user_id,
        "plan_id": plan_id,
        "plan_name": f"AI Mega Assistant {plan_id.capitalize()}" if plan_id != "FREE" else "Free Plan",
        "status": "active" if plan_id != "FREE" else "free",
        "billing_cycle": "monthly",
        "trial_start": None,
        "trial_end": None,
        "subscription_start": now_str,
        "subscription_end": end_str if plan_id != "FREE" else None,
        "promotion_claimed": promotion_claimed,
        "created_at": now_str,
        "updated_at": now_str
    }
    subscriptions.append(new_sub)
    await save_subscriptions(subscriptions)
    
    if user_entry:
        user_entry["account_type"] = plan_id
        save_users(users)
        
    return {
        "status": "success",
        "message": f"Successfully switched to plan {plan_id}.",
        "subscription": new_sub
    }

@app.post("/api/subscription/claim-promotion")
async def claim_promotion(authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(authorization)
    user_id = current_user["sub"]
    users = load_users()
    user_entry = next((u for u in users if u["id"] == user_id), None)
    
    if not user_entry:
        raise HTTPException(status_code=404, detail="User not found.")
        
    config = load_subscription_config()
    if not (config["offer_active"] and config["trial_enabled"]):
        raise HTTPException(status_code=400, detail="Trial promotion is currently inactive.")
        
    if user_entry.get("promotion_claimed", False):
        raise HTTPException(status_code=400, detail="Promotion already claimed.")
        
    subscriptions = await load_subscriptions()
    now_dt = datetime.datetime.utcnow()
    end_dt = calculate_trial_end(now_dt, config["trial_duration"])
    now_str = now_dt.isoformat() + "Z"
    end_str = end_dt.isoformat() + "Z"
    
    sub_id = f"sub_{uuid.uuid4().hex[:12]}"
    new_sub = {
        "id": sub_id,
        "user_id": user_id,
        "plan_id": "PLUS",
        "plan_name": config["plan_name"],
        "status": "trialing",
        "billing_cycle": "monthly",
        "trial_start": now_str,
        "trial_end": end_str,
        "subscription_start": now_str,
        "subscription_end": end_str,
        "promotion_claimed": True,
        "created_at": now_str,
        "updated_at": now_str
    }
    subscriptions.append(new_sub)
    await save_subscriptions(subscriptions)
    
    user_entry["account_type"] = "PLUS"
    user_entry["promotion_claimed"] = True
    save_users(users)
    
    try:
        trial_end_formatted = end_dt.strftime("%Y-%m-%d")
        dispatch_subscription_event_notifications(
            event_type="TRIAL_CLAIMED",
            user_id=user_id,
            user_email=user_entry.get("email", ""),
            user_name=user_entry.get("name", ""),
            trial_end_date=trial_end_formatted
        )
    except Exception as e:
        print("Failed to dispatch trial claimed notifications:", e)

    return {
        "status": "success",
        "message": "Promotion claimed successfully.",
        "subscription": new_sub
    }

@app.post("/api/subscription/checkout")
async def checkout_subscription(req: CheckoutRequest, authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(authorization)
    user_id = current_user["sub"]
    
    plan_id = req.plan_id.upper()
    if plan_id != "PLUS":
        raise HTTPException(status_code=400, detail="Only Plus plan upgrades are supported currently.")
        
    # Check if a real payment provider is configured
    gateway_configured = os.getenv("PAYMENT_GATEWAY_CONFIGURED", "false").lower() == "true"
    
    if not gateway_configured:
        raise HTTPException(
            status_code=400, 
            detail="Payment gateway setup is required to complete this purchase."
        )
        
    config = load_subscription_config()
    # If gateway is configured, perform backend verification and update subscription
    subscriptions = await load_subscriptions()
    now_dt = datetime.datetime.utcnow()
    end_dt = calculate_trial_end(now_dt, config["trial_duration"])
    now_str = now_dt.isoformat() + "Z"
    end_str = end_dt.isoformat() + "Z"
    
    users = load_users()
    user_entry = next((u for u in users if u["id"] == user_id), None)
    
    if req.is_promo:
        if user_entry and user_entry.get("promotion_claimed", False):
            raise HTTPException(status_code=400, detail="Promotion already claimed.")
        # Activate trial
        status = "trialing"
        trial_start = now_str
        trial_end = end_str
        promotion_claimed = True
    else:
        status = "active"
        trial_start = None
        trial_end = None
        promotion_claimed = False
        
    sub_id = f"sub_{uuid.uuid4().hex[:12]}"
    new_sub = {
        "id": sub_id,
        "user_id": user_id,
        "plan_id": "PLUS",
        "plan_name": config["plan_name"],
        "status": status,
        "billing_cycle": req.billing_cycle,
        "trial_start": trial_start,
        "trial_end": trial_end,
        "subscription_start": now_str,
        "subscription_end": end_str,
        "promotion_claimed": promotion_claimed,
        "created_at": now_str,
        "updated_at": now_str
    }
    subscriptions.append(new_sub)
    await save_subscriptions(subscriptions)
    
    if user_entry:
        user_entry["account_type"] = "PLUS"
        if promotion_claimed:
            user_entry["promotion_claimed"] = True
        save_users(users)
        
    return {
        "status": "success",
        "message": "Payment successful. Your Plus subscription is now active.",
        "subscription": new_sub
    }

PAYMENTS_FILE = os.path.join(BASE_DIR, "app", "payments.json")
payments_lock = asyncio.Lock()

def load_payments_sync() -> list:
    if not os.path.exists(PAYMENTS_FILE):
        return []
    try:
        with open(PAYMENTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print("Failed to load payments:", e)
        return []

def save_payments_sync(payments: list):
    try:
        with open(PAYMENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(payments, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save payments:", e)

async def load_payments() -> list:
    async with payments_lock:
        return load_payments_sync()

async def save_payments(payments: list):
    async with payments_lock:
        save_payments_sync(payments)

class CreateVerificationOrderRequest(BaseModel):
    plan_id: str
    billing_cycle: str

class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    plan_id: str
    billing_cycle: str
    is_promo: bool

@app.post("/api/payments/create-verification-order")
async def create_verification_order(req: CreateVerificationOrderRequest, authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(authorization)
    user_id = current_user["sub"]
    
    payment_mode = os.getenv("PAYMENT_MODE", "demo").lower()
    if payment_mode not in ["test", "live", "demo"]:
        payment_mode = "demo"
        
    config = load_subscription_config()
    is_promo = (req.plan_id.upper() == "PLUS" and config["offer_active"] and config["trial_enabled"])
    
    users = load_users()
    user_entry = next((u for u in users if u["id"] == user_id), None)
    promotion_claimed = user_entry.get("promotion_claimed", False) if user_entry else False
    
    if is_promo and promotion_claimed:
        raise HTTPException(
            status_code=400,
            detail="You have already claimed this promotional free trial."
        )
        
    if is_promo:
        amount_paise = config["promo_price"] * 100 if config["promo_price"] > 0 else 100  # ₹1 verification charge or promo price
    else:
        if req.plan_id.upper() != "PLUS":
            raise HTTPException(status_code=400, detail="Only Plus plan upgrades are supported currently.")
        amount_paise = config["monthly_price"] * 100

    if payment_mode == "demo":
        return {
            "status": "success",
            "key_id": "demo_key",
            "order_id": f"order_demo_{uuid.uuid4().hex[:12]}",
            "amount": amount_paise,
            "currency": "INR",
            "is_promo": is_promo,
            "payment_mode": "demo"
        }
        
    import razorpay
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=500,
            detail="Razorpay payment gateway keys are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the backend environment."
        )
        
    try:
        client = razorpay.Client(auth=(key_id, key_secret))
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"receipt_{user_id[:8]}_{uuid.uuid4().hex[:6]}",
            "notes": {
                "user_id": user_id,
                "plan_id": req.plan_id.upper(),
                "billing_cycle": req.billing_cycle,
                "is_promo": str(is_promo)
            }
        }
        order = client.order.create(data=order_data)
        return {
            "status": "success",
            "key_id": key_id,
            "order_id": order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "is_promo": is_promo
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Razorpay order: {str(e)}")


@app.post("/api/payments/verify")
async def verify_payment(req: VerifyPaymentRequest, authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(authorization)
    user_id = current_user["sub"]
    
    payment_mode = os.getenv("PAYMENT_MODE", "demo").lower()
    if payment_mode not in ["test", "live", "demo"]:
        payment_mode = "demo"

    if payment_mode == "demo":
        config = load_subscription_config()
        now_str = datetime.datetime.utcnow().isoformat() + "Z"
        end_dt = calculate_trial_end(datetime.datetime.utcnow(), config["trial_duration"])
        end_str = end_dt.isoformat() + "Z"
        
        users = load_users()
        user_entry = next((u for u in users if u["id"] == user_id), None)
        promotion_claimed = user_entry.get("promotion_claimed", False) if user_entry else False
        
        is_promo = req.is_promo and (req.plan_id.upper() == "PLUS") and config["offer_active"] and config["trial_enabled"]
        amount_paise = (config["promo_price"] * 100 if config["promo_price"] > 0 else 100) if is_promo else (config["monthly_price"] * 100)
        
        # Simulated failure test
        if "fail" in req.razorpay_signature.lower():
            try:
                dispatch_subscription_event_notifications(
                    event_type="VERIFICATION_FAILED" if is_promo else "PAYMENT_FAILED",
                    user_id=user_id,
                    user_email=user_entry.get("email", "") if user_entry else "",
                    user_name=user_entry.get("name", "") if user_entry else "",
                    order_id=req.razorpay_order_id
                )
            except Exception as e:
                print("Failed to dispatch payment failure notification:", e)
            raise HTTPException(
                status_code=400,
                detail="Payment verification failed (Simulated failure)."
            )
            
        payments = await load_payments()
        sub_status = "plus_trial" if is_promo else "plus_active"
        
        payment_record = {
            "payment_id": req.razorpay_payment_id,
            "order_id": req.razorpay_order_id,
            "user_id": user_id,
            "amount": amount_paise,
            "plan_id": req.plan_id.upper(),
            "is_promo": is_promo,
            "verification_status": "simulated",
            "refund_id": f"ref_demo_{uuid.uuid4().hex[:12]}" if is_promo else None,
            "refund_status": "simulated" if is_promo else None,
            "subscription_status": sub_status,
            "payment_mode": "demo",
            "created_at": now_str,
            "updated_at": now_str
        }
        payments.append(payment_record)
        await save_payments(payments)
        
        subscriptions = await load_subscriptions()
        status = "trialing" if is_promo else "active"
        trial_start = now_str if is_promo else None
        trial_end = end_str if is_promo else None
        
        sub_id = f"sub_demo_{uuid.uuid4().hex[:12]}"
        new_sub = {
            "id": sub_id,
            "user_id": user_id,
            "plan_id": "PLUS",
            "plan_name": config["plan_name"],
            "status": status,
            "billing_cycle": req.billing_cycle,
            "trial_start": trial_start,
            "trial_end": trial_end,
            "subscription_start": now_str,
            "subscription_end": end_str,
            "promotion_claimed": True if is_promo else promotion_claimed,
            "payment_id": req.razorpay_payment_id,
            "payment_mode": "demo",
            "created_at": now_str,
            "updated_at": now_str
        }
        subscriptions.append(new_sub)
        await save_subscriptions(subscriptions)
        
        if user_entry:
            user_entry["account_type"] = "PLUS"
            if is_promo:
                user_entry["promotion_claimed"] = True
            save_users(users)

        try:
            if is_promo:
                dispatch_subscription_event_notifications(
                    event_type="VERIFICATION_SUCCESS",
                    user_id=user_id,
                    payment_id=req.razorpay_payment_id,
                    order_id=req.razorpay_order_id
                )
                dispatch_subscription_event_notifications(
                    event_type="TRIAL_CLAIMED",
                    user_id=user_id,
                    user_email=user_entry.get("email", "") if user_entry else "",
                    user_name=user_entry.get("name", "") if user_entry else "",
                    trial_end_date=end_dt.strftime("%Y-%m-%d")
                )
            else:
                dispatch_subscription_event_notifications(
                    event_type="PAID_PURCHASED",
                    user_id=user_id,
                    user_email=user_entry.get("email", "") if user_entry else "",
                    user_name=user_entry.get("name", "") if user_entry else "",
                    payment_id=req.razorpay_payment_id,
                    order_id=req.razorpay_order_id,
                    amount_str="₹899"
                )
        except Exception as e:
            print("Failed to dispatch subscription verify notifications:", e)

        return {
            "status": "success",
            "message": "Payment verified (Simulated) and subscription activated.",
            "subscription": new_sub,
            "payment_record": payment_record
        }

    import razorpay
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    
    if not key_id or not key_secret:
        raise HTTPException(status_code=500, detail="Razorpay keys not configured.")
        
    client = razorpay.Client(auth=(key_id, key_secret))
    try:
        params_dict = {
            'razorpay_order_id': req.razorpay_order_id,
            'razorpay_payment_id': req.razorpay_payment_id,
            'razorpay_signature': req.razorpay_signature
        }
        client.utility.verify_payment_signature(params_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signature verification failed: {str(e)}")
        
    try:
        payment = client.payment.fetch(req.razorpay_payment_id)
        payment_status = payment.get("status", "failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch payment details: {str(e)}")
        
    if payment_status not in ["captured", "authorized"]:
        raise HTTPException(status_code=400, detail=f"Payment status is {payment_status}. Verification failed.")
        
    if payment_status == "authorized":
        try:
            client.payment.capture(req.razorpay_payment_id, payment["amount"])
            payment_status = "captured"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to capture payment: {str(e)}")
            
    config = load_subscription_config()
    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    end_dt = calculate_trial_end(datetime.datetime.utcnow(), config["trial_duration"])
    end_str = end_dt.isoformat() + "Z"
    
    users = load_users()
    user_entry = next((u for u in users if u["id"] == user_id), None)
    promotion_claimed = user_entry.get("promotion_claimed", False) if user_entry else False
    
    is_promo = req.is_promo and (req.plan_id.upper() == "PLUS") and config["offer_active"] and config["trial_enabled"]
    
    payments = await load_payments()
    refund_id = None
    refund_status = None
    
    if is_promo:
        sub_status = "plus_trial"
        verification_status = "captured"
    else:
        sub_status = "plus_active"
        verification_status = "captured"
        
    payment_record = {
        "payment_id": req.razorpay_payment_id,
        "order_id": req.razorpay_order_id,
        "user_id": user_id,
        "amount": payment["amount"],
        "plan_id": req.plan_id.upper(),
        "is_promo": is_promo,
        "verification_status": verification_status,
        "refund_id": refund_id,
        "refund_status": refund_status,
        "subscription_status": sub_status,
        "created_at": now_str,
        "updated_at": now_str
    }
    
    if is_promo:
        try:
            refund_amount = config["promo_price"] * 100 if config["promo_price"] > 0 else 100
            refund = client.payment.refund(req.razorpay_payment_id, {"amount": refund_amount})
            payment_record["refund_id"] = refund["id"]
            payment_record["refund_status"] = "processed" if refund.get("status") == "processed" else "pending"
        except Exception as e:
            payment_record["refund_status"] = "failed"
            print("Refund initiation failed:", e)
            
    payments.append(payment_record)
    await save_payments(payments)
    
    subscriptions = await load_subscriptions()
    
    if is_promo:
        status = "trialing"
        trial_start = now_str
        trial_end = end_str
        promotion_claimed = True
    else:
        status = "active"
        trial_start = None
        trial_end = None
        
    sub_id = f"sub_{uuid.uuid4().hex[:12]}"
    new_sub = {
        "id": sub_id,
        "user_id": user_id,
        "plan_id": "PLUS",
        "plan_name": config["plan_name"],
        "status": status,
        "billing_cycle": req.billing_cycle,
        "trial_start": trial_start,
        "trial_end": trial_end,
        "subscription_start": now_str,
        "subscription_end": end_str,
        "promotion_claimed": promotion_claimed,
        "payment_id": req.razorpay_payment_id,
        "created_at": now_str,
        "updated_at": now_str
    }
    subscriptions.append(new_sub)
    await save_subscriptions(subscriptions)
    
    if user_entry:
        user_entry["account_type"] = "PLUS"
        if promotion_claimed:
            user_entry["promotion_claimed"] = True
        save_users(users)
        
    return {
        "status": "success",
        "message": "Payment verified and subscription activated.",
        "subscription": new_sub,
        "payment_record": payment_record
    }

@app.post("/api/payments/refund-verification")
async def refund_verification(req: dict, authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(authorization)
    payment_id = req.get("payment_id")
    if not payment_id:
        raise HTTPException(status_code=400, detail="payment_id is required.")
        
    payment_mode = os.getenv("PAYMENT_MODE", "demo").lower()
    if payment_mode not in ["test", "live", "demo"]:
        payment_mode = "demo"

    if payment_mode == "demo":
        return {
            "status": "success",
            "message": "Refund processed (Simulated).",
            "record": {
                "payment_id": payment_id,
                "refund_id": f"ref_demo_{uuid.uuid4().hex[:12]}",
                "refund_status": "simulated",
                "verification_status": "simulated"
            }
        }
        
    import razorpay
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    
    if not key_id or not key_secret:
        raise HTTPException(status_code=500, detail="Razorpay keys not configured.")
        
    payments = await load_payments()
    record = next((p for p in payments if p["payment_id"] == payment_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Payment record not found.")
        
    if record["user_id"] != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied.")
        
    if record["refund_status"] == "processed":
        return {"status": "success", "message": "Refund already processed.", "record": record}
        
    client = razorpay.Client(auth=(key_id, key_secret))
    try:
        refund = client.payment.refund(payment_id, {"amount": 100})
        record["refund_id"] = refund["id"]
        record["refund_status"] = "processed" if refund.get("status") == "processed" else "pending"
        record["updated_at"] = datetime.datetime.utcnow().isoformat() + "Z"
        await save_payments(payments)
        return {"status": "success", "message": "Refund initiated.", "record": record}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refund failed: {str(e)}")

@app.get("/api/subscription/status")
async def get_subscription_status(authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(authorization)
    user_id = current_user["sub"]
    subscriptions = await load_subscriptions()
    user_subs = [s for s in subscriptions if s["user_id"] == user_id]
    
    users = load_users()
    user_entry = next((u for u in users if u["id"] == user_id), None)
    promotion_claimed = user_entry.get("promotion_claimed", False) if user_entry else False
    
    if user_subs:
        latest = sorted(user_subs, key=lambda x: x.get("created_at", ""), reverse=True)[0]
        now_str = datetime.datetime.utcnow().isoformat() + "Z"
        
        if check_and_update_subscription_sync(latest, subscriptions, user_entry, users, now_str):
            await save_subscriptions(subscriptions)
            
        if latest["status"].upper() == "EXPIRED":
            return {
                "current_plan": "free",
                "subscription_status": "expired",
                "billing_cycle": "monthly",
                "trial_start": latest.get("trial_start"),
                "trial_end": latest.get("trial_end"),
                "subscription_start": latest.get("subscription_start"),
                "subscription_end": latest.get("subscription_end"),
                "cancel_at_period_end": latest.get("cancel_at_period_end", False),
                "cancelled_at": latest.get("cancelled_at"),
                "promotion_claimed": promotion_claimed
            }
            
        return {
            "current_plan": latest["plan_id"].lower(),
            "subscription_status": latest["status"].lower(),
            "billing_cycle": latest.get("billing_cycle", "monthly"),
            "trial_start": latest.get("trial_start"),
            "trial_end": latest.get("trial_end"),
            "subscription_start": latest.get("subscription_start"),
            "subscription_end": latest.get("subscription_end"),
            "cancel_at_period_end": latest.get("cancel_at_period_end", False),
            "cancelled_at": latest.get("cancelled_at"),
            "promotion_claimed": promotion_claimed
        }
    
    account_type = user_entry.get("account_type", "FREE").lower() if user_entry else "free"
    return {
        "current_plan": account_type,
        "subscription_status": "active" if account_type != "free" else "free",
        "billing_cycle": "monthly",
        "trial_start": None,
        "trial_end": None,
        "subscription_start": None,
        "subscription_end": None,
        "cancel_at_period_end": False,
        "cancelled_at": None,
        "promotion_claimed": promotion_claimed
    }


@app.post("/api/subscription/cancel")
async def cancel_subscription(authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(authorization)
    user_id = current_user["sub"]
    
    subscriptions = await load_subscriptions()
    user_subs = [s for s in subscriptions if s["user_id"] == user_id]
    
    if not user_subs:
        raise HTTPException(status_code=404, detail="No active subscription found.")
        
    latest = sorted(user_subs, key=lambda x: x.get("created_at", ""), reverse=True)[0]
    
    if latest["status"].upper() not in ["ACTIVE", "TRIALING"]:
        raise HTTPException(status_code=400, detail="Subscription is not active.")
        
    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    latest["cancel_at_period_end"] = True
    latest["cancelled_at"] = now_str
    latest["updated_at"] = now_str
    
    await save_subscriptions(subscriptions)
    
    try:
        users = load_users()
        user_entry = next((u for u in users if u["id"] == user_id), None)
        access_end = latest.get("trial_end") or latest.get("subscription_end") or latest.get("next_billing_date")
        if access_end:
            try:
                access_end_formatted = datetime.datetime.fromisoformat(access_end.replace("Z", "")).strftime("%Y-%m-%d")
            except:
                access_end_formatted = str(access_end)[:10]
        else:
            access_end_formatted = "the end of your current billing period"

        dispatch_subscription_event_notifications(
            event_type="CANCELLED",
            user_id=user_id,
            user_email=user_entry.get("email", "") if user_entry else "",
            user_name=user_entry.get("name", "") if user_entry else "",
            access_end_date=access_end_formatted
        )
    except Exception as e:
        print("Failed to dispatch cancel subscription notifications:", e)

    return {
        "status": "success",
        "message": "Subscription cancellation scheduled.",
        "subscription": {
            "current_plan": latest["plan_id"].lower(),
            "subscription_status": latest["status"].lower(),
            "billing_cycle": latest.get("billing_cycle", "monthly"),
            "trial_start": latest.get("trial_start"),
            "trial_end": latest.get("trial_end"),
            "subscription_start": latest.get("subscription_start"),
            "subscription_end": latest.get("subscription_end"),
            "cancel_at_period_end": True,
            "cancelled_at": now_str
        }
    }


@app.post("/api/subscription/reactivate")
async def reactivate_subscription(authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(authorization)
    user_id = current_user["sub"]
    
    subscriptions = await load_subscriptions()
    user_subs = [s for s in subscriptions if s["user_id"] == user_id]
    
    if not user_subs:
        raise HTTPException(status_code=404, detail="No subscription found.")
        
    latest = sorted(user_subs, key=lambda x: x.get("created_at", ""), reverse=True)[0]
    
    if latest["status"].upper() not in ["ACTIVE", "TRIALING"]:
        raise HTTPException(status_code=400, detail="Subscription is not active.")
        
    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    latest["cancel_at_period_end"] = False
    latest["cancelled_at"] = None
    latest["updated_at"] = now_str
    
    await save_subscriptions(subscriptions)
    
    try:
        users = load_users()
        user_entry = next((u for u in users if u["id"] == user_id), None)
        dispatch_subscription_event_notifications(
            event_type="RENEWED",
            user_id=user_id,
            user_email=user_entry.get("email", "") if user_entry else "",
            user_name=user_entry.get("name", "") if user_entry else "",
            amount_str="₹899"
        )
    except Exception as e:
        print("Failed to dispatch reactivate subscription notifications:", e)

    return {
        "status": "success",
        "message": "Subscription successfully reactivated.",
        "subscription": {
            "current_plan": latest["plan_id"].lower(),
            "subscription_status": latest["status"].lower(),
            "billing_cycle": latest.get("billing_cycle", "monthly"),
            "trial_start": latest.get("trial_start"),
            "trial_end": latest.get("trial_end"),
            "subscription_start": latest.get("subscription_start"),
            "subscription_end": latest.get("subscription_end"),
            "cancel_at_period_end": False,
            "cancelled_at": None
        }
    }


class PaymentFailureReportRequest(BaseModel):
    order_id: Optional[str] = None
    error_message: Optional[str] = None
    is_promo: Optional[bool] = False

@app.post("/api/payments/report-failure")
async def report_payment_failure(req: PaymentFailureReportRequest, authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(authorization)
    user_id = current_user["sub"]
    users = load_users()
    user_entry = next((u for u in users if u["id"] == user_id), None)
    user_email = user_entry.get("email", "") if user_entry else ""
    user_name = user_entry.get("name", "") if user_entry else ""
    
    event_type = "VERIFICATION_FAILED" if req.is_promo else "PAYMENT_FAILED"
    dispatch_subscription_event_notifications(
        event_type=event_type,
        user_id=user_id,
        user_email=user_email,
        user_name=user_name,
        order_id=req.order_id
    )
    return {"status": "success", "message": "Payment failure reported and notification created."}


@app.get("/api/user/usage")
async def get_user_usage(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    users = load_users()
    user_plan = get_user_active_plan(user["sub"])
            
    current_date = datetime.datetime.utcnow().date().isoformat()
    usages = load_usages()
    
    # Calculate next midnight for reset_at
    now = datetime.datetime.utcnow()
    next_midnight = datetime.datetime.combine(now.date() + datetime.timedelta(days=1), datetime.time.min)
    reset_at = next_midnight.isoformat() + "Z"
    
    response = {}
    for usage_type in ["photo_upload", "file_upload", "image_generation"]:
        limit = get_plan_limit(user_plan, usage_type)
        
        # find matching usage record
        used = 0
        for record in usages:
            if record.get("user_id") == user["sub"] and record.get("usage_type") == usage_type and record.get("period_start") == current_date:
                used = record.get("count", 0)
                break
                
        response[usage_type] = {
            "allowed": limit == -1 or used < limit,
            "used": used,
            "limit": limit,
            "remaining": -1 if limit == -1 else max(0, limit - used),
            "reset_at": reset_at
        }
    return response

@app.get("/api/user/profile")
async def get_profile(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    users = load_users()
    import datetime
    for u in users:
        if u["id"] == user["sub"]:
            member_date = u.get("member_since")
            if not member_date:
                member_date = datetime.date.today().isoformat()
                u["member_since"] = member_date
                save_users(users)
            return {
                "id": u["id"],
                "name": u["name"],
                "email": u["email"],
                "avatar": u.get("avatar", ""),
                "username": u.get("username", "@" + u["name"].lower().replace(" ", "")),
                "bio": u.get("bio", ""),
                "phone": u.get("phone", ""),
                "country": u.get("country", ""),
                "language": u.get("language", "English"),
                "timezone": u.get("timezone", "UTC"),
                "account_type": get_user_active_plan(u["id"]),
                "member_since": member_date,
                "google_linked": "google_id" in u and bool(u["google_id"]),
                "role": u.get("role", "user"),
                "subscription_details": get_user_subscription_info(u["id"])
            }
    raise HTTPException(status_code=404, detail="User profile not found.")

@app.put("/api/user/profile")
async def update_profile(req: UpdateProfileRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    users = load_users()
    import datetime
    for u in users:
        if u["id"] == user["sub"]:
            if req.name is not None:
                u["name"] = req.name.strip()
            if req.avatar is not None:
                u["avatar"] = req.avatar
            if req.username is not None:
                new_username = req.username.strip().lower()
                if not new_username.startswith("@"):
                    new_username = "@" + new_username
                # Ensure uniqueness
                for other in users:
                    if other["id"] != u["id"] and other.get("username", "").strip().lower() == new_username:
                        raise HTTPException(status_code=400, detail="Username is already taken")
                u["username"] = new_username
            if req.bio is not None:
                u["bio"] = req.bio.strip()
            if req.phone is not None:
                u["phone"] = req.phone.strip()
            if req.country is not None:
                u["country"] = req.country.strip()
            if req.language is not None:
                u["language"] = req.language.strip()
            if req.timezone is not None:
                u["timezone"] = req.timezone.strip()
                
            save_users(users)
            
            member_date = u.get("member_since", datetime.date.today().isoformat())
            return {
                "id": u["id"],
                "name": u["name"],
                "email": u["email"],
                "avatar": u.get("avatar", ""),
                "username": u.get("username", "@" + u["name"].lower().replace(" ", "")),
                "bio": u.get("bio", ""),
                "phone": u.get("phone", ""),
                "country": u.get("country", ""),
                "language": u.get("language", "English"),
                "timezone": u.get("timezone", "UTC"),
                "account_type": get_user_active_plan(u["id"]),
                "member_since": member_date,
                "google_linked": "google_id" in u and bool(u["google_id"]),
                "subscription_details": get_user_subscription_info(u["id"])
            }
    raise HTTPException(status_code=404, detail="User profile not found.")

@app.get("/api/user/check-username")
async def check_username(username: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    users = load_users()
    target_username = username.strip().lower()
    if not target_username.startswith("@"):
        target_username = "@" + target_username
        
    for u in users:
        if u.get("username", "").strip().lower() == target_username and u["id"] != user["sub"]:
            return {"available": False}
    return {"available": True}

@app.post("/api/user/change-password")
async def change_password(req: ChangePasswordRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    users = load_users()
    import bcrypt
    for u in users:
        if u["id"] == user["sub"]:
            if not u.get("password_hash"):
                raise HTTPException(status_code=400, detail="OAuth accounts cannot change passwords directly")
            if not bcrypt.checkpw(req.current_password.encode('utf-8'), u["password_hash"].encode('utf-8')):
                raise HTTPException(status_code=400, detail="Incorrect current password")
            u["password_hash"] = bcrypt.hashpw(req.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            save_users(users)
            
            try:
                from app.notifications import create_notification_internal
                create_notification_internal(
                    user_id=user["sub"],
                    title="Security Update 🔒",
                    message="Your password was changed successfully.",
                    type="account_security",
                    priority="important"
                )
            except Exception as ne:
                print("Failed to dispatch password change notification:", ne)
                
            return {"status": "success", "message": "Password changed successfully"}
    raise HTTPException(status_code=404, detail="User not found")

@app.delete("/api/user/delete-account")
async def delete_account(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    users = load_users()
    filtered = [u for u in users if u["id"] != user["sub"]]
    if len(filtered) == len(users):
        raise HTTPException(status_code=404, detail="User not found")
    save_users(filtered)
    return {"status": "success", "message": "Account deleted successfully"}

# Memories CRUD Endpoints (Secured by JWT)
@app.get("/api/memories")
async def get_memories(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    memories = load_memories()
    user_memories = [m for m in memories if m.get("user_id") == user["sub"]]
    return user_memories

@app.post("/api/memories")
async def save_memory(req: SaveMemoryRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Memory content cannot be empty.")
    
    memories = load_memories()
    for m in memories:
        if m.get("user_id") == user["sub"] and m.get("content", "").lower() == content.lower():
            return m
            
    new_mem = {
        "id": f"mem-{str(uuid.uuid4())}",
        "user_id": user["sub"],
        "content": content,
        "created_at": datetime.datetime.now().isoformat()
    }
    memories.append(new_mem)
    save_memories(memories)
    return new_mem

@app.delete("/api/memories/{memory_id}")
async def delete_memory(memory_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    memories = load_memories()
    updated = [m for m in memories if not (m.get("id") == memory_id and m.get("user_id") == user["sub"])]
    if len(updated) == len(memories):
        raise HTTPException(status_code=404, detail="Memory not found.")
    save_memories(updated)
    return {"status": "success"}

@app.delete("/api/memories")
async def clear_memories(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    memories = load_memories()
    updated = [m for m in memories if m.get("user_id") != user["sub"]]
    save_memories(updated)
    return {"status": "success"}

# Chat Management endpoints (Secured by JWT)
@app.put("/api/chats/{chat_id}/pin")
async def pin_chat(chat_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    chats = load_chats()
    for chat in chats:
        if chat["id"] == chat_id and chat.get("user_id") == user["sub"]:
            chat["pinned"] = True
            chat["updated_at"] = datetime.datetime.now().isoformat()
            save_chats(chats)
            return chat
    raise HTTPException(status_code=404, detail="Chat not found")

@app.put("/api/chats/{chat_id}/unpin")
async def unpin_chat(chat_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    chats = load_chats()
    for chat in chats:
        if chat["id"] == chat_id and chat.get("user_id") == user["sub"]:
            chat["pinned"] = False
            chat["updated_at"] = datetime.datetime.now().isoformat()
            save_chats(chats)
            return chat
    raise HTTPException(status_code=404, detail="Chat not found")

@app.put("/api/chats/{chat_id}/favorite")
async def favorite_chat(chat_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    chats = load_chats()
    for chat in chats:
        if chat["id"] == chat_id and chat.get("user_id") == user["sub"]:
            chat["favorite"] = True
            save_chats(chats)
            return chat
    raise HTTPException(status_code=404, detail="Chat not found")

@app.put("/api/chats/{chat_id}/unfavorite")
async def unfavorite_chat(chat_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    chats = load_chats()
    for chat in chats:
        if chat["id"] == chat_id and chat.get("user_id") == user["sub"]:
            chat["favorite"] = False
            save_chats(chats)
            return chat
    raise HTTPException(status_code=404, detail="Chat not found")

# Chat History CRUD Endpoints (Secured by JWT)
@app.get("/api/chats")
async def get_chats(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    user_chats = await db_load_chats_for_user(user["sub"])
    return user_chats

@app.post("/api/chats")
async def create_chat(req: CreateChatRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    chat_id = req.id if req.id else f"session-{str(uuid.uuid4())}"
    new_chat = {
        "id": chat_id,
        "user_id": user["sub"],
        "title": req.title or "New Chat",
        "messages": [],
        "pinned": False,
        "updated_at": datetime.datetime.now().isoformat()
    }
    await db_save_chat(new_chat)
    return new_chat

@app.get("/api/chats/{chat_id}")
async def get_chat(chat_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    chat = await db_load_chat_by_id(chat_id, user["sub"])
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat

@app.put("/api/chats/{chat_id}")
async def rename_chat(chat_id: str, req: RenameChatRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    chat = await db_load_chat_by_id(chat_id, user["sub"])
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    chat["title"] = req.title.strip()
    chat["updated_at"] = datetime.datetime.now().isoformat()
    await db_save_chat(chat)
    return chat

@app.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    deleted = await db_delete_chat(chat_id, user["sub"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"status": "success"}

@app.delete("/api/chats/{chat_id}/messages")
async def clear_chat_messages(chat_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    chats = load_chats()
    for chat in chats:
        if chat["id"] == chat_id and chat.get("user_id") == user["sub"]:
            chat["messages"] = []
            save_chats(chats)
            return chat
    raise HTTPException(status_code=404, detail="Chat not found")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), authorization: Optional[str] = Header(None)):
    from fastapi import BackgroundTasks
    bg_tasks = BackgroundTasks()
    user = await get_current_user(authorization)
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File extension '{ext}' is not allowed. Allowed types: PDF, DOCX, TXT, images, and code files."
        )

    # Check limit before processing file contents
    is_photo = ext in [".png", ".jpg", ".jpeg", ".webp"]
    usage_type = "photo_upload" if is_photo else "file_upload"
    
    users = load_users()
    user_plan = get_user_active_plan(user["sub"])
            
    limit = get_plan_limit(user_plan, usage_type)
    current_date = datetime.datetime.utcnow().date().isoformat()
    
    async with usage_lock:
        usages = load_usages()
        used = 0
        for record in usages:
            if record.get("user_id") == user["sub"] and record.get("usage_type") == usage_type and record.get("period_start") == current_date:
                used = record.get("count", 0)
                break
        
        if limit != -1 and used >= limit:
            now = datetime.datetime.utcnow()
            next_midnight = datetime.datetime.combine(now.date() + datetime.timedelta(days=1), datetime.time.min)
            reset_at = next_midnight.isoformat() + "Z"
            raise HTTPException(
                status_code=403,
                detail={
                    "allowed": False,
                    "used": used,
                    "limit": limit,
                    "remaining": 0,
                    "reset_at": reset_at,
                    "message": "Daily photo upload limit reached." if usage_type == "photo_upload" else f"You've used all {limit} file uploads available today."
                }
            )
    
    try:
        contents = await file.read()
        file_size = len(contents)
        max_upload_size = get_plan_max_file_size(user_plan)
        if file_size > max_upload_size:
            max_size_mb = max_upload_size / (1024 * 1024)
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds the maximum limit of {max_size_mb:.1f}MB (Found: {file_size / (1024*1024):.2f}MB)."
            )
            
        file_id = str(uuid.uuid4())
        temp_filepath = os.path.join(TEMP_UPLOAD_DIR, file_id)
        with open(temp_filepath, "wb") as f:
            f.write(contents)
            
        # Index file in the background asynchronously
        from app.knowledge_engine import index_file_in_background
        import asyncio
        asyncio.create_task(index_file_in_background(
            user_id=user["sub"],
            file_id=file_id,
            filename=filename,
            file_type=ext,
            file_bytes=contents,
            gemini_api_key=settings.GEMINI_API_KEY,
            gemini_model=settings.GEMINI_MODEL
        ))
            
    except HTTPException:
        raise
    except Exception as e:
        print("Failed upload process:", e)
        raise HTTPException(status_code=500, detail="Failed to parse file contents.")
    
    # Increment usage count only on successful completion
    async with usage_lock:
        usages = load_usages()
        record_found = False
        for record in usages:
            if record.get("user_id") == user["sub"] and record.get("usage_type") == usage_type and record.get("period_start") == current_date:
                record["count"] = record.get("count", 0) + 1
                record["updated_at"] = datetime.datetime.utcnow().isoformat()
                record_found = True
                break
        if not record_found:
            usages.append({
                "user_id": user["sub"],
                "usage_type": usage_type,
                "count": 1,
                "period_type": "daily",
                "period_start": current_date,
                "period_end": current_date,
                "plan": user_plan,
                "created_at": datetime.datetime.utcnow().isoformat(),
                "updated_at": datetime.datetime.utcnow().isoformat()
            })
        save_usages(usages)
        
    return {
        "file_id": file_id,
        "filename": filename,
        "file_type": ext,
        "file_size": file_size
    }

import re
import urllib.parse

import html

async def search_duckduckgo(query: str, max_results: int = 3):
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    results = []
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers, timeout=10.0)
        if res.status_code == 200:
            html_content = res.text
            anchors = re.findall(r'<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>', html_content)
            
            url_to_details = {}
            for href, inner in anchors:
                if "uddg" in href:
                    parsed_url = urllib.parse.urlparse(href)
                    query_params = urllib.parse.parse_qs(parsed_url.query)
                    if "uddg" in query_params:
                        destination_url = query_params["uddg"][0]
                    else:
                        uddg_match = re.search(r'uddg=([^&]+)', href)
                        if uddg_match:
                            destination_url = urllib.parse.unquote(uddg_match.group(1))
                        else:
                            continue
                    
                    clean_text = re.sub(r'<[^>]*>', '', inner).strip()
                    clean_text = html.unescape(clean_text)
                    
                    # Filter out empty texts and domain-looking strings
                    if not clean_text or clean_text.startswith("www.") or clean_text.lower().startswith("http") or ((" " not in clean_text) and ("." in clean_text)):
                        continue
                        
                    if destination_url not in url_to_details:
                        url_to_details[destination_url] = []
                    url_to_details[destination_url].append(clean_text)
                    
            for dest_url, texts in url_to_details.items():
                if not texts:
                    continue
                title = texts[0]
                snippet = texts[1] if len(texts) > 1 else ""
                results.append({
                    "title": title,
                    "url": dest_url,
                    "snippet": snippet
                })
                if len(results) >= max_results:
                    break
    except Exception as e:
        print(f"DuckDuckGo search failed: {e}")
    
    if not results:
        results = [
            {
                "title": f"Google Search Results for '{query}'",
                "url": f"https://www.google.com/search?q={urllib.parse.quote(query)}",
                "snippet": f"Web search references and news matches for the query '{query}' retrieved from Google Search."
            },
            {
                "title": f"Wikipedia Search: '{query}'",
                "url": f"https://en.wikipedia.org/wiki/Special:Search?search={urllib.parse.quote(query)}",
                "snippet": f"Articles and encyclopedic definitions corresponding to the query '{query}' retrieved from Wikipedia."
            }
        ]
    return results

NLU_BASE_PROMPT = (
    "You are AI Mega Assistant, an intelligent, versatile, and highly capable AI assistant.\n"
    "Follow these core conversational directives:\n\n"
    "1. AUTOMATIC LANGUAGE & STYLE MATCHING:\n"
    "   - Automatically detect the user's language and respond in the EXACT SAME language and style.\n"
    "   - English query (e.g., 'what is AI?', 'Explain machine learning', 'hello, how are you', 'what is Python? short answer') -> Respond in English.\n"
    "   - Hindi query (e.g., 'मुझे AI के बारे में बताओ') -> Respond in Hindi (Devanagari script).\n"
    "   - Roman Hindi / Hinglish query (e.g., 'AI kya hota hai?', 'ai ky hota h', 'python kya h', 'machine learning ko detail me samjhao', '2 ladke ja raha hai, sahi hai?') -> Respond naturally in Roman Hindi / Hinglish.\n"
    "   - CRITICAL: IF THE USER WRITES IN ROMAN HINDI (e.g., 'ai ky hota h', 'python kya h', 'detail me samjhao'), YOU MUST RESPOND IN ROMAN HINDI / HINGLISH. NEVER RESPOND IN ENGLISH FOR A ROMAN HINDI USER QUERY.\n"
    "   - Do NOT translate the user's question unnecessarily.\n"
    "   - Do NOT correct informal Roman Hindi spelling unless the user explicitly asks for grammar correction.\n\n"
    "2. INTELLIGENT RESPONSE LENGTH & DEPTH CONTROL:\n"
    "   - SIMPLE / SHORT QUESTION (e.g., 'What is AI?', 'ai ky hota h', 'python kya h', 'API kya hai'): Provide a CONCISE 2-3 SENTENCE answer (e.g., \"AI (Artificial Intelligence) ek technology hai jo computers aur machines ko insaan ki tarah seekhne aur decisions lene mein help karti hai. ChatGPT aur voice assistants AI ke examples hain.\"). Do NOT generate a huge theoretical lecture or multi-section breakdown!\n"
    "   - NORMAL QUESTION (e.g., 'Explain machine learning', 'How does Python work?'): Provide a moderate explanation with key concepts (2 short paragraphs or clean points).\n"
    "   - EXPLICIT DETAIL REQUEST (e.g., 'explain in detail', 'detail me samjhao', 'deeply explain', 'step by step'): Provide a detailed, structured, multi-section answer.\n"
    "   - VERY SHORT REQUEST (e.g., 'short answer', 'in short', 'briefly', 'one line'): Provide a very brief, direct 1 sentence answer.\n\n"
    "3. NATURAL CONVERSATIONAL TONE & NO UNNECESSARY QUESTIONS:\n"
    "   - Be warm, direct, and conversational.\n"
    "   - Avoid robotic textbook fluff (e.g., 'Certainly!', 'Here is a comprehensive explanation...', 'Let me provide you with...').\n"
    "   - NEVER end answers with repetitive follow-up questions like 'Are you studying Machine Learning for a specific course, exam, or project?'. Finish the answer naturally.\n\n"
    "4. HINDI GRAMMAR & INTENT EVALUATION:\n"
    "   - Understand informal Roman Hindi intent even with imperfect spelling ('ai ky hota h' = 'AI kya hota hai?').\n"
    "   - If the user explicitly asks for grammar correction (e.g., '2 ladke ja raha hai, sahi hai?'), evaluate singular/plural and subject-verb agreement (e.g., '2 ladke' is plural, so verb is 'ja rahe hain'), politely provide the corrected sentence ('Nahi, sentence ko aise likhna sahi hoga: \"2 ladke ja rahe hain.\"'), and PRESERVE ORIGINAL MEANING 100%.\n\n"
    "5. SIMPLE & CLEAN CODE EXPLANATIONS:\n"
    "   - For coding requests (e.g., 'Write a Python program to check whether a number is prime'), provide clean, beginner-friendly code FIRST with a short explanation. Do NOT over-engineer."
)

AGENT_INSTRUCTIONS = {
    "general": (
        "You are the General Assistant. You handle everyday questions, greetings, conversations, and general knowledge queries.\n"
        "Be friendly, conversational, and direct."
    ),
    "coding": (
        "You are the Coding Assistant. You specialize in programming, software engineering, debugging, and code writing.\n"
        "For simple code requests, provide clean, beginner-friendly code first with a short explanation. Avoid over-engineering unless requested."
    ),
    "writing": (
        "You are the Writing Assistant. You specialize in drafts, emails, essays, grammar checks, content writing, and proofreading.\n"
        "Ensure excellent tone, rich style, perfect grammar, and elegant formatting."
    ),
    "research": (
        "You are the Research Scientist Agent. You specialize in deep research, topic analysis, literature reviews, market research, detailed reports, and comparisons.\n"
        "Provide well-structured, fact-based answers with clear headings, comparative tables, and bullet points."
    ),
    "education": (
        "You are the Education Assistant. You specialize in learning, studying, concept explanations, and tutorial assistance.\n"
        "Break down complex ideas into clear, structured explanations. Avoid unnecessary lectures or repetitive follow-up questions."
    ),
    "math": (
        "You are the Math Assistant. You specialize in calculations, algebraic equations, proofs, and mathematical concepts.\n"
        "Provide step-by-step mathematical explanations. Highlight all formulas and clearly show the calculations."
    ),
    "knowledge": (
        "You are the Knowledge & General Intelligence Agent. You handle queries about Science, History, Geography, technology concepts, general knowledge, everyday life, and definitions.\n"
        "Provide accurate, clear, and easy-to-understand explanations. Adjust answer complexity based on user context. Provide examples whenever useful."
    ),
    "decision": (
        "You are the Decision Making Agent. You specialize in recommendations, comparisons, purchases, career/course/tool selection, and pros & cons analyses.\n"
        "Provide:\n"
        "1. A short recommendation\n"
        "2. A comparison table (when useful)\n"
        "3. Pros and Cons\n"
        "4. Alternative options\n"
        "5. Final suggestion with reasoning based on user budget, use case, and preferences."
    ),
    "troubleshoot": (
        "You are the Troubleshooting & Technical Support Agent. You specialize in software/hardware errors, installation problems, configuration guides, development setup issues, browser/OS problems, and error log/screenshot analysis.\n"
        "Provide step-by-step problem-solving solutions. Explain commands clearly. Ask for error details or logs if missing, and suggest verification steps to check if the issue is solved."
    ),
    "shopping": (
        "You are the Shopping & Product Research Agent. You specialize in product recommendations, buying guides, specs comparisons, and shopping decisions (e.g. laptops, mobiles, electronics, software tools).\n"
        "Provide:\n"
        "1. Recommended products\n"
        "2. A comparison table (when useful)\n"
        "3. Pros and Cons\n"
        "4. Best choice according to user needs\n"
        "5. Alternative options."
    ),
    "career": (
        "You are the Career & Placement Agent. You specialize in career guidance, placements, internships, resume reviews, learning roadmaps, interview preparation, and job search strategies.\n"
        "Provide practical, actionable guidance, structured roadmaps, and project descriptions tailored to students, freshers, and professionals."
    ),
    "finance": (
        "You are the Finance Assistant Agent. You specialize in personal budgeting, money management, cost analysis, savings plans, SIPs, and basic financial concepts.\n"
        "Provide practical and clear explanations. Include calculations and examples. Clarify risks and include standard financial disclaimers."
    ),
    "travel": (
        "You are the Travel & Planning Agent. You specialize in trip planning, day-wise itineraries, destination comparison, packing checklists, travel budgets, routes, and travel tips.\n"
        "Provide highly organized day-by-day itineraries, use comparison tables when useful, estimate basic budgets (stay, food, activities), and adapt recommendations to user budgets."
    ),
    "health": (
        "You are the Health & Wellness Agent. You specialize in fitness guidance, workout plans, healthy diet meal ideas, sleep improvement, stress management, and wellness habits.\n"
        "AI Safety Warning: Provide only general wellness information. Do NOT diagnose diseases or replace professional medical advice. Clearly recommend consulting professional medical experts for any serious concerns."
    ),
    "creative": (
        "You are the Creative Assistant Agent. You specialize in creative writing, storytelling, social media captions, marketing campaigns, startup/brand naming, brainstorming outlines, and innovative project ideas.\n"
        "Provide rich, practical options, encourage innovative concepts, and adapt your tone to the user's specific project goals."
    ),
    "data_analysis": (
        "You are the Data Analysis Agent. You specialize in analyzing datasets (CSV/Excel files), data cleaning, finding patterns/trends, statistics, business insights, and generating reports/charts.\n"
        "Explain insights clearly, highlight key findings, and present reports with tables and charts when useful."
    ),
    "productivity": (
        "You are the Personal Productivity & Goal Planner Agent. You specialize in daily/weekly planning, task organization, study roadmaps, time management advice (like Pomodoro), habit building, and step-by-step goal timelines.\n"
        "Provide highly actionable daily plans, checklists, milestones, and timetables tailored to the user's specific schedule."
    ),
    "document": (
        "You are the Document & File Intelligence Agent. You specialize in reading uploaded files (PDFs, Word documents, text files), extracting key facts, summarizing research papers, reviewing resumes, and generating professional reports.\n"
        "Explain complex documents in simple language, highlight critical points with bullet points, and present clear summaries."
    ),
    "vision": (
        "You are the Multimodal Vision Agent. You specialize in analyzing uploaded images, screenshots, diagrams, UI layouts, error screenshots, and OCR text extraction.\n"
        "Explain visual findings clearly, provide step-by-step guidance, and mention if the image resolution or quality is insufficient."
    ),
    "voice": (
        "You are the Voice Intelligence Agent. You specialize in handling speech-to-text, text-to-speech, voice command understanding, and conversational voice flows.\n"
        "Explain voice control options, assist with speech commands, and provide clear spoken-style assistance."
    ),
    "vault": (
        "You are the AI Memory & Personal Knowledge Vault Agent. You specialize in managing long-term user memories, saved notes, project ideas, knowledge collections, and personal references.\n"
        "Explain saved items, retrieve context from past sessions, organize notes, and verify user consent before saving new preferences."
    ),
    "web_research": (
        "You are the Web Research & Real-Time Information Agent. You specialize in retrieving up-to-date details, recent news, software versions, current dates/times, stock prices, and official documentation.\n"
        "Explain real-time concepts using the retrieved web search grounding context, and cite your sources cleanly."
    )
}

def route_agent_local(message: str) -> str:
    msg_lower = normalize_nlu_message(message)
    
    # 1. Web Research/Real-Time keywords
    web_research_kws = ["latest version", "python version", "cricket match", "youtube channels", "react documentation", "react docs", "latest news", "stock price", "exchange rate", "today's date", "current time", "what is the date", "weather today", "price of bitcoin", "who won"]
    if any(kw in msg_lower for kw in web_research_kws):
        return "web_research"

    # 2. Vault/Memory keywords
    vault_kws = ["remember that", "what do i prefer", "what programming language", "save this project", "personal knowledge vault", "show my saved notes", "saved notes", "my memories", "view memories", "clear stored data", "my preferences", "delete memory"]
    if any(kw in msg_lower for kw in vault_kws):
        return "vault"

    # 3. Voice keywords
    voice_kws = ["voice control", "speech to text", "text to speech", "voice command", "voice agent", "speak responses", "read aloud", "voice responses"]
    if any(kw in msg_lower for kw in voice_kws):
        return "voice"

    # 4. Vision keywords
    vision_kws = ["is image", "is screenshot", "is diagram", "screenshot me", "image me", "extract text from image", "ocr image", "error screen", "explain diagram"]
    if any(kw in msg_lower for kw in vision_kws):
        return "vision"

    # 5. Document keywords
    document_kws = ["pdf ka", "resume ko", "research paper", "report create", "document summary", "summarize doc", "word file", "pdf summary", "extract from file", "summarize this document", "uploaded file", "docx summary", "text file summary", "pdf report", "explain paper", "summarize this", "short me batao", "key points", "tldr", "summary do"]
    if any(kw in msg_lower for kw in document_kws):
        return "document"

    # 6. Productivity keywords
    productivity_kws = ["learning plan", "learning roadmap", "study planner", "timetable", "daily tasks", "organize tasks", "weekly schedule", "goal planning", "milestones", "habit building", "time management", "pomodoro", "study plan"]
    if any(kw in msg_lower for kw in productivity_kws):
        return "productivity"

    # 7. Research Scientist specific keywords
    research_spec_kws = ["deep research", "literature review", "market research", "technical research", "fact-based explanation", "future research", "detailed comparison", "complete analysis"]
    if any(kw in msg_lower for kw in research_spec_kws):
        return "research"

    # 8. Data analysis keywords
    data_analysis_kws = ["csv file", "excel file", "dataset", "data analysis", "clean data", "visualize data", "sales report", "business insights", "data trend", "graph banao", "chart banao", "summarize data"]
    if any(kw in msg_lower for kw in data_analysis_kws):
        return "data_analysis"

    # 9. Creative keywords
    creative_kws = ["creative", "story", "brainstorm", "social media", "instagram", "caption", "script", "startup idea", "brand name", "marketing idea", "project idea", "naming", "presentation idea", "caption likho", "story ideas"]
    if any(kw in msg_lower for kw in creative_kws):
        return "creative"

    # 10. Health keywords
    health_kws = ["health", "fitness", "wellness", "exercise", "workout", "sleep", "nutrition", "diet", "meal planning", "stress management", "healthy habit", "lifestyle", "fitness routine"]
    if any(kw in msg_lower for kw in health_kws):
        return "health"

    # 11. Travel keywords
    travel_kws = ["travel", "trip", "destination", "itinerary", "places to visit", "packing checklist", "route planning", "visa guide", "travel budget", "trip plan", "visit jaipur", "manali trip", "goa trip"]
    if any(kw in msg_lower for kw in travel_kws):
        return "travel"

    # 12. Finance keywords
    finance_kws = ["finance", "budget", "salary", "save", "savings", "emi", "sip", "expense", "tracking", "money management", "cost comparison", "investment"]
    if any(kw in msg_lower for kw in finance_kws):
        return "finance"

    # 13. Troubleshoot keywords
    troubleshoot_kws = ["error", "install", "not working", "fails to", "slow", "setup guide", "configuration issue", "browser issue", "cannot connect", "crashed", "slow laptop", "extension not installing", "npm install error", "fix error", "help with", "troubleshoot", "debugging error"]
    if any(kw in msg_lower for kw in troubleshoot_kws):
        return "troubleshoot"

    # 14. Career keywords
    career_kws = ["career", "placement", "internship", "resume", "roadmap", "job search", "interview prep", "mock interview", "how to become", "banne ke liye", "seekhu", "learning path", "skills needed", "hr interview", "interview preparation", "prepare me for hr", "interview me hr", "kal mera hr", "hr round", "hr question", "cv bana do", "resume bana do"]
    if any(kw in msg_lower for kw in career_kws):
        return "career"

    # 15. Coding keywords
    coding_kws = ["code", "python", "javascript", "typescript", "java", "c++", "debugging", "bug", "function", 
                  "class", "compile", "error", "exception", "github", "git", "api", "endpoint", "fastapi", 
                  "react", "html", "css", "sql", "database", "query", "array", "list", "loop", "programming",
                  "developer", "script", "json", "xml", "syntax", "null", "undefined", "pointer", "stack"]
    if any(kw in msg_lower for kw in coding_kws):
        return "coding"
        
    # 16. Shopping keywords
    shopping_kws = ["buy", "purchase", "shopping", "laptop under", "phone under", "headphones", "gadgets", "brand", "best laptop", "best phone", "buying guide", "product comparisons", "iphone vs samsung"]
    if any(kw in msg_lower for kw in shopping_kws):
        return "shopping"

    # 17. Math keywords
    math_kws = ["solve", "equation", "calculate", "math", "formula", "integral", "derivative", "algebra", 
                "geometry", "calculus", "matrix", "proof", "x^2", "plus", "minus", "multiplied", 
                "divided", "quadratic", "triangle", "circle", "theorem", "fraction", "logarithm", "sine", "cosine"]
    if any(kw in msg_lower for kw in math_kws) or any(char in msg_lower for char in ["+", "=", "*", "/"]):
        return "math"
        
    # 18. Writing keywords
    writing_kws = ["write", "email", "essay", "draft", "formal", "letter", "grammar", "proofread", 
                   "paragraph", "resume", "cv", "cover letter", "thank-you", "copywriting", "creative writing", "poem", "drafting", "translate", "translation", "me karo", "me convert karo"]
    if any(kw in msg_lower for kw in writing_kws):
        return "writing"
        
    # 19. Research keywords
    research_kws = ["research", "summarize", "factors", "history", "key events", "gather", "information", 
                    "sources", "news", "article", "wikipedia", "timeline", "analysis", "statistics", "report",
                    "deep research", "literature review", "market research", "technical research", "fact-based explanation"]
    if any(kw in msg_lower for kw in research_kws):
        return "research"
        
    # 20. Decision keywords
    decision_kws = ["best laptop", "best phone", "better than", "vs", "versus", "comparison", "recommend", "recommendation", "should i buy", "which one", "pros and cons", "career choices", "tool selection", "react or angular", "python or javascript", "kaunsa lu", "kaunsa buy"]
    if any(kw in msg_lower for kw in decision_kws):
        return "decision"
        
    # 21. Knowledge keywords
    knowledge_kws = ["science", "geography", "quantum", "photosynthesis", "internet", "invented", "inventor", 
                     "general knowledge", "everyday life", "how does this work", "how do they work", "what is", "who is", "define", "definition"]
    if any(kw in msg_lower for kw in knowledge_kws):
        return "knowledge"
        
    # 22. Education keywords
    education_kws = ["explain", "concept", "teach", "lesson", "tutorial", "student", "school", "study", 
                     "notes", "learn", "how to", "how does", "why does"]
    if any(kw in msg_lower for kw in education_kws):
        return "education"
        
    return "general"

async def route_agent(message: str) -> str:
    """
    Route the user's instruction to the appropriate specialized agent using fast local classification.
    Consumes 0 Gemini API calls.
    """
    return route_agent_local(message)

async def extract_and_save_memories_from_message(user_id: str, message: str):
    if not settings.GEMINI_API_KEY or not message.strip():
        return
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    prompt = (
        "Analyze the following user message to AI. Extract any user preferences, user's name, or key personal facts that should be remembered across chats. "
        "Return ONLY a valid JSON list of short strings representing the extracted facts (e.g., [\"User's name is Mani\", \"User prefers typescript\"]). "
        "If there are no personal facts, names, or preferences to extract, return exactly []. Do not include markdown formatting or backticks.\n\n"
        f"User Message: {message}"
    )
    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, timeout=10.0)
        if res.status_code == 200:
            text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            if "```" in text:
                text = text.replace("```json", "").replace("```", "").strip()
            import json
            facts = json.loads(text)
            if isinstance(facts, list) and len(facts) > 0:
                memories = load_memories()
                for fact in facts:
                    duplicate = False
                    for m in memories:
                        if m.get("user_id") == user_id and m.get("content", "").lower() == fact.lower():
                            duplicate = True
                            break
                    if not duplicate:
                        memories.append({
                            "id": f"mem-{str(uuid.uuid4())}",
                            "user_id": user_id,
                            "content": fact,
                            "created_at": datetime.datetime.now().isoformat()
                        })
                save_memories(memories)
    except Exception as e:
        print(f"Failed to extract memories: {e}")

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, authorization: Optional[str] = Header(None)):
    req_start_time = time.time()
    req_id = f"req-{str(uuid.uuid4())[:8]}"
    tool_info = None
    tool_outputs = {}
    user = await get_current_user(authorization)
    
    # Check if API Key is configured
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        return {"reply": "API Key Error: Please set a valid GEMINI_API_KEY in the backend/.env file."}

    chats = load_chats()
    active_chat = None
    for chat in chats:
        if chat["id"] == request.chat_id and chat.get("user_id") == user["sub"]:
            active_chat = chat
            break
            
    if not active_chat:
        active_chat = {
            "id": request.chat_id,
            "user_id": user["sub"],
            "title": "New Chat",
            "messages": [],
            "pinned": False,
            "updated_at": datetime.datetime.now().isoformat()
        }
        chats.insert(0, active_chat)

    active_chat["updated_at"] = datetime.datetime.now().isoformat()

    if not request.message.strip() and not request.file:
        return {"reply": "Please enter a message prompt or attach a file to analyze."}

    # === USER PREFERENCE COMMAND HANDLING ===
    from app.preferences_engine import handle_preference_commands, get_preferences_grounding_context, learn_preferences_from_conversation, get_adaptive_style_prompt
    pref_reply = handle_preference_commands(user["sub"], request.message)
    if pref_reply:
        user_msg = {
            "id": str(uuid.uuid4()),
            "sender": "user",
            "text": request.message,
            "timestamp": datetime.datetime.now().isoformat(),
        }
        active_chat["messages"].append(user_msg)
        bot_msg = {
            "id": str(uuid.uuid4()),
            "sender": "bot",
            "text": pref_reply,
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": "General"
        }
        active_chat["messages"].append(bot_msg)
        save_chats(chats)
        return {"reply": pref_reply, "sources": None, "agent": "General"}

    # === UNIVERSAL INTENT ROUTING & EXECUTION ===
    from app.universal_router import route_intents, execute_router_tools, generate_execution_plan, normalize_nlu_message
    
    # Generate multi-step execution plan using Gemini reasoning and history
    plan = await generate_execution_plan(request.message, settings.GEMINI_API_KEY, settings.GEMINI_MODEL, history_messages=active_chat.get("messages", []))
    print(f"[UNIVERSAL ROUTER PLAN]: {plan}")
    
    intents = route_intents(request.message, has_file=(request.file is not None))
    if plan.get("steps"):
        for step in plan["steps"]:
            if step not in intents:
                intents.append(step)
                
    # Execute matching capabilities in planned order
    tool_outputs = await execute_router_tools(user["sub"], intents, request.message, plan=plan)
    
    # Check if a single local fast response is sufficient (pure tool intent, no assistant/chat intents)
    fast_eligible = ["date_time", "calendar", "qr_generator", "barcode_generator", "currency_converter", "unit_converter", "calculator", "table_generator", "chart_generator"]
    is_pure_tool = len(intents) > 0 and all(i in fast_eligible for i in intents) and not any(i in ["coding_assistant", "writing_assistant", "education_assistant", "math_assistant", "web_search", "general_chat"] for i in intents)
    
    if is_pure_tool and tool_outputs:
        reply_parts = []
        tool_info = None
        for k, v in tool_outputs.items():
            if k == "date_time":
                reply_parts.append(f"The current system time is {v}.")
            elif k == "unit_converter":
                reply_parts.append(f"Unit conversion result: {v}.")
            elif k == "currency_converter":
                reply_parts.append(f"Currency conversion result: {v}.")
            elif k == "calculator":
                reply_parts.append(f"Calculation result: {v}.")
            elif k == "calendar":
                reply_parts.append("I have generated the calendar for you.")
                tool_info = {"name": "Calendar", "input": request.message, "output": v, "type": "html"}
            elif k == "qr_generator":
                reply_parts.append(f"I have successfully generated your QR code.")
                tool_info = {"name": "QR Code Generator", "input": request.message, "output": v, "type": "image"}
            elif k == "barcode_generator":
                reply_parts.append(f"I have successfully generated your barcode.")
                tool_info = {"name": "Barcode Generator", "input": request.message, "output": v, "type": "image"}
            elif k == "table_generator":
                reply_parts.append(f"Here is your table:\n\n{v}")
            elif k == "chart_generator":
                reply_parts.append("I have successfully created the chart visualization below.")
                tool_info = {"name": "Chart Generator", "input": request.message, "output": v, "type": "chart"}
                
        reply_text = " ".join(reply_parts)
        
        user_msg = {
            "id": str(uuid.uuid4()),
            "sender": "user",
            "text": request.message,
            "timestamp": datetime.datetime.now().isoformat(),
        }
        if request.file:
            user_msg["file"] = request.file
        active_chat["messages"].append(user_msg)
        
        bot_msg = {
            "id": str(uuid.uuid4()),
            "sender": "bot",
            "text": reply_text,
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": "General",
            "tool_info": tool_info
        }
        active_chat["messages"].append(bot_msg)
        save_chats(chats)
        return {"reply": reply_text, "sources": None, "agent": "General", "tool_info": tool_info}

    # AI Productivity Intent Parser
    lower_msg = request.message.lower().strip()

    # === AI Workflow Automation Intent Parser ===
    # A. Execute explicit workflow runs
    exec_match = re.search(r'^(?:execute|run|trigger)\s+workflow\s+(?:named\s+)?[\'"]?(.+?)[\'"]?$', request.message, re.IGNORECASE)
    if exec_match:
        target_name = exec_match.group(1).strip().lower()
        from app.automation import load_workflows, execute_workflow_actions, save_history, load_history
        workflows = load_workflows()
        target_flow = None
        for w in workflows:
            if w.get("user_id") == user["sub"] and (w.get("name", "").lower() == target_name or target_name in w.get("name", "").lower()):
                target_flow = w
                break
        if target_flow:
            try:
                from app.notifications import create_notification_internal
                create_notification_internal(
                    user_id=user["sub"],
                    title="Workflow Execution",
                    message="AI workflow started.",
                    type="automation",
                    related_module=target_flow["id"]
                )
            except Exception as ne:
                print("Failed to dispatch workflow start notification:", ne)

            try:
                log_summary = execute_workflow_actions(user["sub"], target_flow["actions"])
                if "Failed executing action" in log_summary:
                    raise Exception(log_summary)
                history = load_history()
                hist_entry = {
                    "id": str(uuid.uuid4()),
                    "workflow_id": target_flow["id"],
                    "workflow_name": target_flow["name"],
                    "user_id": user["sub"],
                    "status": "success",
                    "trigger": "chat",
                    "executed_at": datetime.datetime.now().isoformat(),
                    "details": log_summary
                }
                history.insert(0, hist_entry)
                save_history(history)
                try:
                    create_notification_internal(
                        user_id=user["sub"],
                        title="Workflow Executed ⚡",
                        message="AI workflow completed successfully.",
                        type="automation",
                        related_module="automation"
                    )
                except Exception as ne:
                    print("Failed to dispatch workflow notification:", ne)
                print(f"[AUTOMATION MATCHED] Executed workflow: '{target_flow['name']}'")
                reply_text = f"Executed workflow '**{target_flow['name']}**' successfully.\n\n**Details:** {log_summary}"
            except Exception as e:
                history = load_history()
                hist_entry = {
                    "id": str(uuid.uuid4()),
                    "workflow_id": target_flow["id"],
                    "workflow_name": target_flow["name"],
                    "user_id": user["sub"],
                    "status": "failed",
                    "trigger": "chat",
                    "executed_at": datetime.datetime.now().isoformat(),
                    "details": f"Error: {str(e)}"
                }
                history.insert(0, hist_entry)
                save_history(history)
                try:
                    from app.notifications import create_notification_internal
                    create_notification_internal(
                        user_id=user["sub"],
                        title="Workflow Failed ❌",
                        message="AI workflow failed. Check details.",
                        type="automation",
                        related_module="automation"
                    )
                except Exception as ne:
                    print("Failed to dispatch workflow notification:", ne)
                reply_text = f"Failed to execute workflow '**{target_flow['name']}**'.\n\n**Error:** {str(e)}"
            
            user_msg = {
                "id": str(uuid.uuid4()),
                "sender": "user",
                "text": request.message,
                "timestamp": datetime.datetime.now().isoformat()
            }
            active_chat["messages"].append(user_msg)
            bot_msg = {
                "id": str(uuid.uuid4()),
                "sender": "bot",
                "text": reply_text,
                "timestamp": datetime.datetime.now().isoformat(),
                "agent": "General"
            }
            active_chat["messages"].append(bot_msg)
            save_chats(chats)
            return {"reply": reply_text, "sources": None, "agent": "General"}

    # B. Create workflow via Natural Language keyword/prefix
    create_wf_match = re.search(r'^(?:create|setup|add|automate)\s+workflow\s*(?:named|called|:)?\s*(.+)$', request.message, re.IGNORECASE)
    if create_wf_match or any(k in lower_msg for k in ["every morning", "schedule workflow"]):
        prompt_text = create_wf_match.group(1).strip() if create_wf_match else request.message.strip()
        
        from app.automation import parse_workflow_local_fallback, load_workflows, save_workflows
        parsed_flow = parse_workflow_local_fallback(prompt_text)
        
        workflows = load_workflows()
        new_flow = {
            "id": str(uuid.uuid4()),
            "user_id": user["sub"],
            "name": parsed_flow["name"],
            "trigger_type": parsed_flow["trigger_type"],
            "trigger_detail": parsed_flow["trigger_detail"],
            "actions": parsed_flow["actions"],
            "enabled": True,
            "created_at": datetime.datetime.now().isoformat(),
            "updated_at": datetime.datetime.now().isoformat()
        }
        workflows.insert(0, new_flow)
        save_workflows(workflows)
        
        print(f"[AUTOMATION MATCHED] Created workflow: '{new_flow['name']}'")
        reply_text = f"I've successfully created the workflow: '**{new_flow['name']}**'\n\n**Trigger:** {new_flow['trigger_detail']}\n**Actions:** {len(new_flow['actions'])} configured."
        
        user_msg = {
            "id": str(uuid.uuid4()),
            "sender": "user",
            "text": request.message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        active_chat["messages"].append(user_msg)
        bot_msg = {
            "id": str(uuid.uuid4()),
            "sender": "bot",
            "text": reply_text,
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": "General"
        }
        active_chat["messages"].append(bot_msg)
        save_chats(chats)
        return {"reply": reply_text, "sources": None, "agent": "General"}

    # C. Implicit Automation actions direct trigger
    if "save this response as a note" in lower_msg or "save response as a note" in lower_msg:
        from app.automation import run_save_response
        log_msg = run_save_response(user["sub"], {})
        reply_text = f"Workflow Action Executed: {log_msg}"
        
        print("[AUTOMATION MATCHED] Action: Save Response")
        
        user_msg = {
            "id": str(uuid.uuid4()),
            "sender": "user",
            "text": request.message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        active_chat["messages"].append(user_msg)
        bot_msg = {
            "id": str(uuid.uuid4()),
            "sender": "bot",
            "text": reply_text,
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": "General"
        }
        active_chat["messages"].append(bot_msg)
        save_chats(chats)
        return {"reply": reply_text, "sources": None, "agent": "General"}

    if "summarize this document and save it" in lower_msg or "summarize latest document" in lower_msg:
        from app.automation import run_summarize_document
        log_msg = run_summarize_document(user["sub"], {"document_id": "latest"})
        reply_text = f"Workflow Action Executed: {log_msg}"
        
        print("[AUTOMATION MATCHED] Action: Summarize Document")
        
        user_msg = {
            "id": str(uuid.uuid4()),
            "sender": "user",
            "text": request.message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        active_chat["messages"].append(user_msg)
        bot_msg = {
            "id": str(uuid.uuid4()),
            "sender": "bot",
            "text": reply_text,
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": "General"
        }
        active_chat["messages"].append(bot_msg)
        save_chats(chats)
        return {"reply": reply_text, "sources": None, "agent": "General"}
    
    # A. Create a task from message
    task_create_match = re.search(
        r'(?:create|add)(?:\s+a)?\s+task\s+(?:to\s+)?(.+?)(?:\s+with\s+priority\s+(low|medium|high))?$', 
        request.message, 
        re.IGNORECASE
    )
    if task_create_match:
        title = task_create_match.group(1).strip()
        priority = (task_create_match.group(2) or "medium").lower()
        tasks = load_tasks()
        new_task = {
            "id": str(uuid.uuid4()),
            "user_id": user["sub"],
            "title": title,
            "priority": priority,
            "completed": False,
            "created_at": datetime.datetime.now().isoformat()
        }
        tasks.insert(0, new_task)
        save_tasks(tasks)
        try:
            from app.notifications import create_notification_internal
            create_notification_internal(
                user_id=user["sub"],
                title="Task Created 📋",
                message=f"New task created by AI Automation: '{title}'",
                type="task",
                related_module="tasks"
            )
        except Exception as ne:
            print("Failed to dispatch task creation notification:", ne)
        print(f"[PRODUCTIVITY MATCHED] Create Task: '{title}'")
        
        reply_text = f"I've successfully created the task: '**{title}**' with **{priority.capitalize()}** priority."
        user_msg = {
            "id": str(uuid.uuid4()),
            "sender": "user",
            "text": request.message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        active_chat["messages"].append(user_msg)
        bot_msg = {
            "id": str(uuid.uuid4()),
            "sender": "bot",
            "text": reply_text,
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": "General"
        }
        active_chat["messages"].append(bot_msg)
        
        if active_chat["title"] == "New Chat":
            active_chat["title"] = request.message.strip()[:25] + "..." if len(request.message.strip()) > 25 else request.message.strip()
            
        save_chats(chats)
        return {"reply": reply_text, "sources": None, "agent": "General"}

    # B. Summarize pending tasks
    if any(k in lower_msg for k in ["summarize my tasks", "pending tasks", "my tasks", "list tasks"]):
        tasks = load_tasks()
        user_tasks = [t for t in tasks if t.get("user_id") == user["sub"] and not t.get("completed")]
        
        print("[PRODUCTIVITY MATCHED] List Tasks")
        
        if not user_tasks:
            reply_text = "You don't have any pending tasks right now. Great job!"
        else:
            reply_text = "Here is a summary of your pending tasks:\n\n"
            for t in user_tasks:
                prio_caps = t['priority'].upper()
                reply_text += f"- **[{prio_caps}]** {t['title']}\n"
                
        user_msg = {
            "id": str(uuid.uuid4()),
            "sender": "user",
            "text": request.message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        active_chat["messages"].append(user_msg)
        bot_msg = {
            "id": str(uuid.uuid4()),
            "sender": "bot",
            "text": reply_text,
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": "General"
        }
        active_chat["messages"].append(bot_msg)
        
        if active_chat["title"] == "New Chat":
            active_chat["title"] = request.message.strip()[:25] + "..." if len(request.message.strip()) > 25 else request.message.strip()
            
        save_chats(chats)
        return {"reply": reply_text, "sources": None, "agent": "General"}

    # C. Suggest task planning (Prepare custom planning prompt for Gemini)
    if any(k in lower_msg for k in ["suggest task planning", "task planning", "plan my tasks", "suggest a plan"]):
        tasks = load_tasks()
        user_tasks = [t for t in tasks if t.get("user_id") == user["sub"] and not t.get("completed")]
        
        print("[PRODUCTIVITY MATCHED] Plan Tasks")
        
        if not user_tasks:
            planning_prompt = "The user has no pending tasks. Suggest general productivity tips and how to plan a new day."
        else:
            planning_prompt = (
                "You are the Productivity Planner. Here is a list of the user's pending tasks:\n"
            )
            for t in user_tasks:
                planning_prompt += f"- [{t['priority'].upper()}] {t['title']}\n"
            planning_prompt += (
                "\nPlease suggest a detailed, actionable, step-by-step plan/schedule to accomplish these tasks today. "
                "Group them logically (e.g. by priority or time of day) and offer solid time-management advice."
            )
        request.message = planning_prompt

    # D. Create a note from message
    note_create_match = re.search(
        r'^(?:create|save|add)(?:\s+a)?\s+note\s*(?:about|:)?\s*(.+)$', 
        request.message, 
        re.IGNORECASE
    )
    if note_create_match:
        content = note_create_match.group(1).strip()
        title = content[:25] + "..." if len(content) > 25 else content
        
        notes = load_notes()
        new_note = {
            "id": str(uuid.uuid4()),
            "user_id": user["sub"],
            "title": title,
            "content": content,
            "pinned": False,
            "created_at": datetime.datetime.now().isoformat(),
            "updated_at": datetime.datetime.now().isoformat()
        }
        notes.insert(0, new_note)
        save_notes(notes)
        
        print(f"[PRODUCTIVITY MATCHED] Create Note: '{title}'")
        
        reply_text = f"I've successfully saved a note: '**{title}**'."
        user_msg = {
            "id": str(uuid.uuid4()),
            "sender": "user",
            "text": request.message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        active_chat["messages"].append(user_msg)
        bot_msg = {
            "id": str(uuid.uuid4()),
            "sender": "bot",
            "text": reply_text,
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": "General"
        }
        active_chat["messages"].append(bot_msg)
        
        if active_chat["title"] == "New Chat":
            active_chat["title"] = request.message.strip()[:25] + "..." if len(request.message.strip()) > 25 else request.message.strip()
            
        save_chats(chats)
        return {"reply": reply_text, "sources": None, "agent": "General"}

    # E. List notes from message
    if any(k in lower_msg for k in ["show my notes", "list my notes", "list notes"]) or lower_msg == "my notes":
        notes = load_notes()
        user_notes = [n for n in notes if n.get("user_id") == user["sub"]]
        
        print("[PRODUCTIVITY MATCHED] List Notes")
        
        if not user_notes:
            reply_text = "You don't have any notes saved yet."
        else:
            reply_text = "Here are your saved notes:\n\n"
            for n in user_notes:
                pin_badge = "📌 " if n.get("pinned") else ""
                reply_text += f"- **{pin_badge}{n['title']}**: {n['content']}\n"
                
        user_msg = {
            "id": str(uuid.uuid4()),
            "sender": "user",
            "text": request.message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        active_chat["messages"].append(user_msg)
        bot_msg = {
            "id": str(uuid.uuid4()),
            "sender": "bot",
            "text": reply_text,
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": "General"
        }
        active_chat["messages"].append(bot_msg)
        
        if active_chat["title"] == "New Chat":
            active_chat["title"] = request.message.strip()[:25] + "..." if len(request.message.strip()) > 25 else request.message.strip()
            
        save_chats(chats)
        return {"reply": reply_text, "sources": None, "agent": "General"}

    # F. Create a reminder from message
    remind_me_to_match = re.search(
        r'^(?:remind\s+me\s+to|set\s+(?:a\s+)?reminder\s+for)\s+(.+)$', 
        request.message, 
        re.IGNORECASE
    )
    if remind_me_to_match:
        rem_text = remind_me_to_match.group(1).strip()
        now = datetime.datetime.now()
        rem_datetime = now + datetime.timedelta(hours=2)
        clean_title = rem_text
        lower_rem = rem_text.lower()
        
        if "tomorrow" in lower_rem:
            rem_datetime = now + datetime.timedelta(days=1)
            rem_datetime = rem_datetime.replace(hour=9, minute=0, second=0, microsecond=0)
            clean_title = re.sub(r'\s+tomorrow', '', rem_text, flags=re.IGNORECASE)
            
        at_match = re.search(r'\s+at\s+(\d+)(?:\s*(pm|am))?', lower_rem)
        if at_match:
            hour = int(at_match.group(1))
            meridian = at_match.group(2)
            if meridian == "pm" and hour < 12:
                hour += 12
            elif meridian == "am" and hour == 12:
                hour = 0
            rem_datetime = rem_datetime.replace(hour=hour, minute=0, second=0, microsecond=0)
            clean_title = re.sub(r'\s+at\s+\d+\s*(?:pm|am)?', '', clean_title, flags=re.IGNORECASE)
            
        clean_title = clean_title.strip()
        reminders = load_reminders()
        new_rem = {
            "id": str(uuid.uuid4()),
            "user_id": user["sub"],
            "title": clean_title,
            "datetime": rem_datetime.isoformat(),
            "completed": False,
            "created_at": now.isoformat()
        }
        reminders.insert(0, new_rem)
        save_reminders(reminders)
        try:
            from app.notifications import create_notification_internal
            create_notification_internal(
                user_id=user["sub"],
                title="Reminder Created ⏰",
                message="Reminder created successfully.",
                type="reminder",
                related_module=new_rem["id"]
            )
        except Exception as ne:
            print("Failed to dispatch reminder notification:", ne)
        print(f"[PRODUCTIVITY MATCHED] Create Reminder: '{clean_title}' at {rem_datetime.isoformat()}")
        
        formatted_dt = rem_datetime.strftime("%Y-%m-%d at %I:%M %p")
        reply_text = f"I've set a reminder: '**{clean_title}**' for **{formatted_dt}**."
        
        user_msg = {
            "id": str(uuid.uuid4()),
            "sender": "user",
            "text": request.message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        active_chat["messages"].append(user_msg)
        bot_msg = {
            "id": str(uuid.uuid4()),
            "sender": "bot",
            "text": reply_text,
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": "General"
        }
        active_chat["messages"].append(bot_msg)
        
        if active_chat["title"] == "New Chat":
            active_chat["title"] = request.message.strip()[:25] + "..." if len(request.message.strip()) > 25 else request.message.strip()
            
        save_chats(chats)
        return {"reply": reply_text, "sources": None, "agent": "General"}

    # G. List reminders from message
    if any(k in lower_msg for k in ["show my reminders", "list my reminders", "what are my reminders", "list reminders"]):
        reminders = load_reminders()
        user_rems = [r for r in reminders if r.get("user_id") == user["sub"] and not r.get("completed")]
        
        print("[PRODUCTIVITY MATCHED] List Reminders")
        
        if not user_rems:
            reply_text = "You don't have any upcoming reminders scheduled."
        else:
            reply_text = "Here are your upcoming reminders:\n\n"
            for r in user_rems:
                dt_obj = datetime.datetime.fromisoformat(r['datetime'])
                formatted_dt = dt_obj.strftime("%Y-%m-%d at %I:%M %p")
                reply_text += f"- **{r['title']}** (scheduled for {formatted_dt})\n"
                
        user_msg = {
            "id": str(uuid.uuid4()),
            "sender": "user",
            "text": request.message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        active_chat["messages"].append(user_msg)
        bot_msg = {
            "id": str(uuid.uuid4()),
            "sender": "bot",
            "text": reply_text,
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": "General"
        }
        active_chat["messages"].append(bot_msg)
        
        if active_chat["title"] == "New Chat":
            active_chat["title"] = request.message.strip()[:25] + "..." if len(request.message.strip()) > 25 else request.message.strip()
            
        save_chats(chats)
        return {"reply": reply_text, "sources": None, "agent": "General"}

    print(f"[NO TOOL MATCHED] falling back to Gemini for query: '{request.message.encode('utf-8', errors='ignore').decode('utf-8')}'")
    raw_model = (settings.GEMINI_MODEL or "gemini-flash-latest").strip().strip("'\"")
    clean_model = raw_model[7:] if raw_model.startswith("models/") else raw_model
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={settings.GEMINI_API_KEY}"
    
    parts = []
    
    # Process attached file metadata
    if request.file:
        file_id = request.file.get("file_id")
        filename = request.file.get("filename", "file")
        file_type = request.file.get("file_type", "").lower()
        
        temp_filepath = os.path.join(TEMP_UPLOAD_DIR, file_id) if file_id else ""
        if not temp_filepath or not os.path.exists(temp_filepath):
            return {"reply": "Error: Attached file could not be located on the server. Please upload it again."}
            
        try:
            with open(temp_filepath, "rb") as f:
                file_bytes = f.read()
        except Exception:
            return {"reply": f"Error: Failed to read attached file '{filename}' contents."}
            
        # Parse based on file type
        if file_type in [".png", ".jpg", ".jpeg", ".webp", ".pdf"]:
            b64_data = base64.b64encode(file_bytes).decode("utf-8")
            mime_types = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".webp": "image/webp",
                ".pdf": "application/pdf"
            }
            mime_type = mime_types.get(file_type, "application/octet-stream")
            
            parts.append({
                "inline_data": {
                    "mime_type": mime_type,
                    "data": b64_data
                }
            })
            
            prompt_text = request.message.strip()
            if not prompt_text:
                prompt_text = "Analyze and explain this document." if file_type == ".pdf" else "Describe this image in detail."
            parts.append({"text": prompt_text})
            
        else:
            extracted_text = ""
            if file_type == ".docx":
                extracted_text = extract_text_from_docx(temp_filepath)
            else:
                try:
                    extracted_text = file_bytes.decode("utf-8", errors="ignore")
                except Exception:
                    extracted_text = "Error: Failed to decode text file contents."
            
            file_prompt = f"[Attached File Content: {filename}]\n"
            if file_type == ".docx":
                file_prompt += f"{extracted_text}\n"
            else:
                lang = file_type.replace(".", "")
                file_prompt += f"```{lang}\n{extracted_text}\n```\n"
                
            if request.message.strip():
                file_prompt += f"\nUser Instruction: {request.message.strip()}"
            else:
                default_action = "Explain this code file." if file_type in [".py", ".js", ".ts", ".java", ".cpp", ".html", ".css", ".json"] else "Summarize this document."
                file_prompt += f"\nUser Instruction: {default_action}"
                
            parts.append({"text": file_prompt})
    else:
        parts.append({"text": request.message})
        
    # === Background Knowledge Engine Integration ===
    cleaned_message = request.message.strip()
    is_permanent_intent = False
    is_forget_intent = False
    
    perm_patterns = [
        r'\bremember this permanently\b',
        r'\bsave this for future\b',
        r'\balways remember this\b'
    ]
    if any(re.search(pat, cleaned_message.lower()) for pat in perm_patterns):
        is_permanent_intent = True
        cleaned_text = cleaned_message
        for pat in perm_patterns:
            cleaned_text = re.sub(pat, '', cleaned_text, flags=re.IGNORECASE)
        cleaned_text = cleaned_text.strip(" :.,!?'\"")
        if cleaned_text:
            from app.knowledge_engine import add_knowledge_entry
            add_knowledge_entry(
                user_id=user["sub"],
                title="User Specified Memory",
                content=cleaned_text,
                type_name="permanent",
                metadata={"source": "user_instruction"}
            )
            print(f"[KNOWLEDGE ENGINE] Saved permanent memory: '{cleaned_text}'")

    forget_patterns = [
        r'\bforget this\b',
        r'\bremove this memory\b',
        r'\bdelete this memory\b',
        r'\bforget about\s+(.+)$'
    ]
    forget_keyword = ""
    for pat in forget_patterns:
        m = re.search(pat, cleaned_message.lower())
        if m:
            is_forget_intent = True
            if len(m.groups()) > 0 and m.group(1):
                forget_keyword = m.group(1).strip()
            break
            
    if is_forget_intent:
        if not forget_keyword:
            cleaned_text = cleaned_message
            for pat in [r'\bforget this\b', r'\bremove this memory\b', r'\bdelete this memory\b']:
                cleaned_text = re.sub(pat, '', cleaned_text, flags=re.IGNORECASE)
            forget_keyword = cleaned_text.strip(" :.,!?'\"")
        if forget_keyword:
            from app.knowledge_engine import delete_knowledge_by_keyword
            deleted = delete_knowledge_by_keyword(user["sub"], forget_keyword)
            print(f"[KNOWLEDGE ENGINE] Forgot memory matching: '{forget_keyword}' (Success: {deleted})")

    from app.knowledge_engine import search_relevant_knowledge
    relevant_memories = search_relevant_knowledge(user["sub"], request.message)
    used_sources = []
    
    if relevant_memories:
        mem_str = "[AI BACKGROUND KNOWLEDGE - Refer to these relevant historical files, documents, and past conversations to answer the query accurately:\n"
        for idx, entry in enumerate(relevant_memories):
            source_name = entry.get("title", "Unknown Source")
            type_label = entry.get("type", "Document")
            content = entry.get("content", "")
            if len(content) > 1500:
                content = content[:1500] + "... [Content truncated to fit context window]"
            mem_str += f"Source [{idx+1}]: {source_name} (Type: {type_label})\nContent:\n{content}\n\n"
            used_sources.append({
                "id": entry.get("id"),
                "title": source_name,
                "type": type_label,
                "created_at": entry.get("created_at")
            })
        mem_str += "]"
        parts.insert(0, {"text": mem_str})

    # Inject user memories facts (legacy base)
    memories = load_memories()
    user_mem = [m["content"] for m in memories if m.get("user_id") == user["sub"]]
    if user_mem:
        mem_str = "[AI Memory Fact Base - Use these facts about the user for context & personalization when relevant:\n"
        for m in user_mem:
            mem_str += f"- {m}\n"
        mem_str += "]"
        parts.insert(0, {"text": mem_str})

    # Inject learned preferences context
    pref_context = get_preferences_grounding_context(user["sub"])
    parts.insert(0, {"text": pref_context})

    # Inject tool outputs grounding if any ran in the universal router pipeline
    if tool_outputs:
        grounding_str = "[SYSTEM ROUTER TOOL GROUNDING - The following tool queries were executed successfully. Integrate these results seamlessly into your conversational response without mentioning 'tools' or 'grounding':\n"
        for tk, tv in tool_outputs.items():
            grounding_str += f"- {tk}: {tv}\n"
        grounding_str += "]"
        parts.insert(0, {"text": grounding_str})
        
        # Populate tool_info for returning visual renderings to the frontend client
        if "qr_generator" in tool_outputs:
            tool_info = {
                "name": "QR Code Generator",
                "input": request.message,
                "output": tool_outputs["qr_generator"],
                "type": "image"
            }
        elif "barcode_generator" in tool_outputs:
            tool_info = {
                "name": "Barcode Generator",
                "input": request.message,
                "output": tool_outputs["barcode_generator"],
                "type": "image"
            }
        elif "chart_generator" in tool_outputs:
            tool_info = {
                "name": "Chart Generator",
                "input": request.message,
                "output": tool_outputs["chart_generator"],
                "type": "chart"
            }
        elif "calendar" in tool_outputs:
            tool_info = {
                "name": "Calendar",
                "input": request.message,
                "output": tool_outputs["calendar"],
                "type": "html"
            }

    # Automatically categorize query using AI Brain Router
    routing_msg = request.message
    if not routing_msg.strip() and request.file:
        file_ext = os.path.splitext(request.file.get("filename", ""))[1].lower()
        if file_ext in [".py", ".js", ".ts", ".java", ".cpp", ".html", ".css", ".json"]:
            routing_msg = "Explain this programming source code file."
        elif file_ext in [".docx", ".txt"]:
            routing_msg = "Summarize this document content."
        else:
            routing_msg = "Describe this uploaded file."
            
    is_image = False
    if request.file:
        file_ext = os.path.splitext(request.file.get("filename", ""))[1].lower()
        if file_ext in [".png", ".jpg", ".jpeg", ".webp"]:
            is_image = True

    if is_image:
        agent_key = "vision"
    else:
        # 1. Try local regex match first
        agent_key = route_agent_local(routing_msg)
        if agent_key == "general":
            # 2. Extract from execution plan steps if possible to avoid redundant Gemini calls
            plan_steps = plan.get("steps") if plan else []
            MAP_STEP_TO_AGENT = {
                "vault": "vault",
                "voice": "voice",
                "vision": "vision",
                "document": "document",
                "productivity": "productivity",
                "research": "research",
                "data_analysis": "data_analysis",
                "creative": "creative",
                "health": "health",
                "travel": "travel",
                "finance": "finance",
                "troubleshoot": "troubleshoot",
                "career": "career",
                "shopping": "shopping",
                "math": "math",
                "writing": "writing",
                "coding": "coding",
                "coding_assistant": "coding",
                "writing_assistant": "writing",
                "education_assistant": "education",
                "math_assistant": "math",
                "web_search": "web_research",
                "web_research": "web_research",
                "education": "education"
            }
            mapped_agent = "general"
            for step in plan_steps:
                if step in MAP_STEP_TO_AGENT:
                    mapped_agent = MAP_STEP_TO_AGENT[step]
                    break
            if mapped_agent != "general":
                agent_key = mapped_agent
            else:
                agent_key = await route_agent(routing_msg)

    # Determine if web search is needed automatically
    should_search = request.web_search or (agent_key == "web_research")

    # Query Web Search if active
    sources = []
    if should_search and request.message.strip():
        search_results = await search_duckduckgo(request.message.strip())
        sources = [
            {
                "title": r["title"],
                "url": r["url"],
                "timestamp": datetime.datetime.now().isoformat()
            }
            for r in search_results
        ]
        search_context = "[WEB SEARCH GROUNDING INFO - Refer to these facts to construct an accurate, up-to-date answer:\n"
        for idx, r in enumerate(search_results):
            search_context += f"Source [{idx+1}]: {r['title']}\nURL: {r['url']}\nSnippet: {r['snippet']}\n\n"
        search_context += "]"
        parts.insert(0, {"text": search_context})

    agent_name = agent_key.capitalize()
    if agent_key == "research":
        agent_name = "Research Scientist"
    elif agent_key == "web_research":
        agent_name = "Web Research Agent"
    NLU_BASE_PROMPT = (
        "You are equipped with advanced Multilingual Intelligence & Natural Language Understanding (NLU).\n"
        "Rules of communication:\n"
        "1. Language & Phrasing: Automatically detect and respond in the user's language or Hinglish/code-mixed style. Keep the conversation natural.\n"
        "2. Typing & Spelling Errors: Automatically correct and understand spelling/grammar errors (e.g. 'pythin', 'intrview', 'me kal resume upload kiya'). Never ask the user to correct them.\n"
        "3. Context & References: Resolve pronouns ('it', 'this', 'same') and uploaded file references ('this PDF', 'my resume') using the conversation history context.\n"
        "4. Smart Clarification: If the query is genuinely and highly ambiguous (e.g. 'Explain Java' - Indonesian island or coding language?), ask one brief clarification question to determine user intent. Otherwise, do not ask unnecessary clarifications.\n"
        "5. Emotion & Urgency Adaptation: Automatically evaluate the user's emotional state, urgency level, and communication constraints:\n"
        "   - Frustrated / Stressed (e.g., emojis '😭', 'yaar ye error aa raha h'): Respond calmly, be reassuring, and explain the solution step by step without becoming overly emotional or unprofessional.\n"
        "   - Urgent (e.g., 'jaldi batao', 'interview in 10 mins'): Prioritize response speed and clarity. Give a highly concise, practical answer first. Offer further details only if requested.\n"
        "   - In-depth request (e.g., 'mujhe detail me samjhao'): Provide a comprehensive explanation with examples.\n"
        "   - Bullet points request (e.g., 'bas points me batao'): Respond strictly using short concise bullet points.\n"
        "   - Teacher style (e.g., 'like a teacher'): Teach patiently step-by-step, use real-life analogies, and naturally prompt at the end to check understanding.\n"
        "   - Kid / Simple style (e.g., 'like I am 10 years old'): Use basic vocabulary and simple real-life examples.\n"
        "6. Smart Action Prediction: If the user mentions a significant upcoming event or career target, proactively list next steps at the end of your message in a short, separate section (e.g. 'Proactive Suggestions' or 'How I can help next:'). Do not force actions. Examples:\n"
        "   - Interview Tomorrow (e.g. 'My interview is tomorrow'): Offer: (1) HR interview questions, (2) Resume review, (3) Mock interview, (4) Last-minute interview tips.\n"
        "   - Exam Next Week (e.g. 'I have an exam next week'): Suggest: (1) Structured study plan, (2) Summary notes/mindmaps, (3) Study flashcards, (4) Important questions.\n"
        "   - Applying to Google/Tech Company (e.g. 'I want to apply for Google'): Suggest: (1) Tech resume improvement, (2) Target cover letter, (3) Interview preparation, (4) DSA roadmap.\n"
    )
    original_agent_prompt = AGENT_INSTRUCTIONS.get(agent_key, AGENT_INSTRUCTIONS["general"])
    agent_prompt = f"{NLU_BASE_PROMPT}\n{original_agent_prompt}"
    
    # 5. Adaptive Style & Explanation Intelligence integration
    style_prompt = get_adaptive_style_prompt(user["sub"], request.message)
    agent_prompt = f"{agent_prompt}\n{style_prompt}"

    # 6. Intelligent Context Switching & Topic Restoration
    is_restore_request = any(k in request.message.lower() for k in ["continue the previous topic", "go back to previous topic", "restore previous topic", "previous topic"])
    restored_agent_key = None
    
    if is_restore_request and active_chat.get("messages"):
        # Scan backward to find the current active agent name
        current_agent = None
        for m in reversed(active_chat["messages"]):
            if m.get("sender") == "bot" and m.get("agent") and m.get("agent") != "general":
                current_agent = m["agent"]
                break
                
        # Scan further backward to find a different agent name
        previous_agent = None
        for m in reversed(active_chat["messages"]):
            if m.get("sender") == "bot" and m.get("agent") and m.get("agent") != "general":
                if current_agent and m["agent"] != current_agent:
                    previous_agent = m["agent"]
                    break
                elif not current_agent:
                    previous_agent = m["agent"]
                    break
                    
        if previous_agent:
            # Override active agent key
            restored_agent_key = previous_agent.lower()
            if restored_agent_key == "research scientist":
                restored_agent_key = "research"
            elif restored_agent_key == "web research agent":
                restored_agent_key = "web_research"
            
            agent_key = restored_agent_key
            agent_name = previous_agent
            
            # Reconstruct agent prompt and inject context restoration instruction
            original_agent_prompt = AGENT_INSTRUCTIONS.get(agent_key, AGENT_INSTRUCTIONS["general"])
            restore_prompt = (
                f"\n[CONTEXT RESTORATION DIRECTIVE: The user has requested to restore the previous topic of the '{agent_name}' agent. "
                "Disregard the most recent discussion topic, switch back to the previous topic context, and continue answering questions "
                "or writing code related to that previous conversation thread.]"
            )
            agent_prompt = f"{NLU_BASE_PROMPT}\n{original_agent_prompt}\n{restore_prompt}"

    # Construct context-managed multi-turn contents
    contents = []
    
    # Always append the last 6 conversation turns for reference resolution and NLU context
    if active_chat.get("messages"):
        error_keywords = [
            "returned an error", "rate limit", "timed out", "quota", "unavailable",
            "invalid gemini api", "not authorized", "please set a valid gemini_api_key"
        ]
        
        relevant_messages = [
            m for m in active_chat.get("messages", [])
            if m.get("text") and not m.get("text").startswith("Tool Executed:")
            and not any(err_kw in m.get("text", "").lower() for err_kw in error_keywords)
        ]
        
        # If context restoration is active, prioritize the historical messages from the target agent
        if restored_agent_key:
            target_agent_name = agent_name
            restored_turns = []
            # Scan history and pick turns from target agent
            for i, m in enumerate(relevant_messages):
                if m.get("agent") == target_agent_name:
                    # Append the user query preceding it if possible
                    if i > 0 and relevant_messages[i-1].get("sender") == "user":
                        restored_turns.append(relevant_messages[i-1])
                    restored_turns.append(m)
            
            # Combine the last 2 transition turns with the restored turns
            combined_messages = restored_turns[-4:] + relevant_messages[-2:]
            # De-duplicate while preserving order
            seen_ids = set()
            final_messages = []
            for m in combined_messages:
                if m["id"] not in seen_ids:
                    seen_ids.add(m["id"])
                    final_messages.append(m)
        else:
            final_messages = relevant_messages[-6:]
            
        history_turns = []
        last_role = None
        for msg in final_messages:
            role = "user" if msg["sender"] == "user" else "model"
            text_str = msg.get("text", "").strip()
            if text_str and role != last_role:
                history_turns.append({
                    "role": role,
                    "parts": [{"text": text_str}]
                })
                last_role = role
                
        # Enforce Gemini role constraints:
        # 1. First turn in contents MUST be 'user'
        while history_turns and history_turns[0]["role"] != "user":
            history_turns.pop(0)
            
        # 2. Last turn in history before adding new user query MUST be 'model' (to avoid user -> user)
        while history_turns and history_turns[-1]["role"] != "model":
            history_turns.pop()
            
        contents.extend(history_turns)

    # Clean active query parts to ensure no empty text parts exist
    clean_parts = []
    for p in parts:
        if "inline_data" in p:
            clean_parts.append(p)
        elif "text" in p and p["text"] and p["text"].strip():
            clean_parts.append({"text": p["text"].strip()})

    if not clean_parts:
        clean_parts = [{"text": request.message.strip() if request.message and request.message.strip() else "Hello"}]

    # Finally, append the active query turn
    contents.append({
        "role": "user",
        "parts": clean_parts
    })

    payload = {
        "contents": contents
    }

    if request.web_search and sources:
        search_instruction = (
            "You are a helpful AI assistant with real-time web search capabilities.\n"
            "You must use the provided real-time internet search results context (WEB SEARCH GROUNDING INFO) to answer the user's query.\n"
            "Synthesize a detailed, concise summary of the latest news or facts from the snippets. Do NOT just list or recommend news websites or tell the user to visit them.\n"
            "If the search results contain specific headlines, statistics, match scores, or news details, you MUST include them explicitly in your response.\n"
            "Cite the sources you use to support your statements by mentioning the Source index in brackets linked to the URL (e.g. 'According to [1](url)...' or '...final scorecard [2](url)').\n"
            "Never answer with only a list of websites or general recommendations unless no useful grounding facts are available."
        )
        combined_prompt = f"{agent_prompt}\n\n{search_instruction}"
        payload["systemInstruction"] = {
            "parts": [{"text": combined_prompt}]
        }
    else:
        payload["systemInstruction"] = {
            "parts": [{"text": agent_prompt}]
        }

    # Append user message to history
    user_msg = {
        "id": str(uuid.uuid4()),
        "sender": "user",
        "text": request.message,
        "timestamp": datetime.datetime.now().isoformat(),
    }
    if request.file:
        user_msg["file"] = request.file
    active_chat["messages"].append(user_msg)

    # Automatically rename New Chat
    if active_chat["title"] == "New Chat":
        if request.message.strip():
            active_chat["title"] = request.message.strip()[:25] + "..." if len(request.message.strip()) > 25 else request.message.strip()
        elif request.file:
            active_chat["title"] = f"Analyze: {request.file.get('filename')}"
    
    # Define a helper to construct a recovery response using local knowledge, memory, and tools
    def construct_recovery_reply(error_reason: str) -> str:
        msg = f"{error_reason}\n\n"
        msg += "=== Local Recovery Info ===\n"
        
        recovered_any = False
        # 1. Check local tool outputs
        if tool_outputs:
            msg += "**Tool Results Recovered locally**:\n"
            for tk, tv in tool_outputs.items():
                msg += f"- {tk}: {tv}\n"
            recovered_any = True
            
        # 2. Check relevant files/knowledge base entries
        if relevant_memories:
            msg += "\n**Knowledge Base & Uploaded Files Facts**:\n"
            for entry in relevant_memories[:2]:
                title = entry.get("title", "Document")
                content = entry.get("content", "")
                msg += f"- *From {title}*: {content[:300]}\n"
            recovered_any = True
            
        # 3. Check memory facts
        if user_mem:
            msg += "\n**User Memories Found**:\n"
            for m in user_mem[:3]:
                msg += f"- {m}\n"
            recovered_any = True
            
        if not recovered_any:
            msg += "No local knowledge, memories, or active tools were found for this query."
        else:
            msg += "\n*Partial results successfully loaded from local context.*"
            
        msg += "\n\n**Next Best Action**: Wait a moment for rate limits to clear, or continue querying using local command lines."
        return msg

    is_personalized_ctx = bool(request.file or relevant_memories or user_mem or tool_outputs or pref_context)
    
    from app.services.ai_provider import global_ai_orchestrator
    ai_result = await global_ai_orchestrator.generate_with_resilience(
        req_id=req_id,
        user_id=user["sub"],
        prompt=request.message,
        payload=payload,
        is_personalized=is_personalized_ctx
    )
    
    reply_text = ai_result.get("text", "AI provider is temporarily unavailable.")
    is_gemini_error = ai_result.get("error", False)

    # If error occurred but a local tool output was generated, present tool output cleanly
    if is_gemini_error and tool_outputs:
        reply_parts = []
        for tk, tv in tool_outputs.items():
            reply_parts.append(f"{tk}: {tv}")
        reply_text = f"Tool Result: {' | '.join(reply_parts)}\n\n({reply_text})"

    # Append bot reply to history
    bot_msg = {
        "id": str(uuid.uuid4()),
        "sender": "bot",
        "text": reply_text,
        "timestamp": datetime.datetime.now().isoformat(),
        "agent": agent_name,
        "tool_info": tool_info
    }
    if sources:
        bot_msg["sources"] = sources

    active_chat["messages"].append(bot_msg)
    save_chats(chats)

    # Only learn preferences & index knowledge base for successful AI responses
    if not is_gemini_error:
        try:
            learn_preferences_from_conversation(user["sub"], request.message, reply_text)
        except Exception as pe:
            print("Failed to auto-learn preferences:", pe)

        should_extract_memory = any(kw in request.message.lower() for kw in ["remember", "my name", "i prefer", "i love", "my favorite", "save this", "preference", "like to"])
        if request.message.strip() and should_extract_memory:
            asyncio.create_task(extract_and_save_memories_from_message(user["sub"], request.message.strip()))

        try:
            from app.knowledge_engine import add_knowledge_entry
            file_info = {}
            if request.file:
                file_info["file_id"] = request.file.get("file_id")
                file_info["filename"] = request.file.get("filename")
                file_info["file_type"] = request.file.get("file_type")
            add_knowledge_entry(
                user_id=user["sub"],
                title=f"Chat: {request.message.strip()[:30]}" if request.message.strip() else "Chat attachment turn",
                content=f"User: {request.message.strip()}\nAI: {reply_text}",
                type_name="chat",
                related_module=request.chat_id,
                metadata={"chat_id": request.chat_id, "prompt": request.message.strip(), "reply": reply_text, "file": file_info}
            )
        except Exception as ie:
            print("Failed to auto-index conversation turn:", ie)

    # Development-only request & quota usage logging
    req_latency = time.time() - req_start_time
    user_id_short = user.get("sub", "anon")[:8]
    print(f"[CHAT LOG] Req ID: {req_id} | User ID: {user_id_short} | Category: {agent_name} | Gemini Calls: {gemini_calls_count} | Model: {settings.GEMINI_MODEL} | Latency: {req_latency:.2f}s", flush=True)

    return {
        "reply": reply_text,
        "sources": sources if sources else None,
        "agent": agent_name,
        "used_sources": used_sources if used_sources else None,
        "tool_info": tool_info
    }

@app.post("/api/image/generate")
async def generate_image_endpoint(request: ImageGenerateRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    # Check limit before calling pollinations API
    users = load_users()
    user_plan = get_user_active_plan(user["sub"])
            
    limit = get_plan_limit(user_plan, "image_generation")
    current_date = datetime.datetime.utcnow().date().isoformat()
    
    async with usage_lock:
        usages = load_usages()
        used = 0
        for record in usages:
            if record.get("user_id") == user["sub"] and record.get("usage_type") == "image_generation" and record.get("period_start") == current_date:
                used = record.get("count", 0)
                break
                
        if limit != -1 and used >= limit:
            now = datetime.datetime.utcnow()
            next_midnight = datetime.datetime.combine(now.date() + datetime.timedelta(days=1), datetime.time.min)
            reset_at = next_midnight.isoformat() + "Z"
            raise HTTPException(
                status_code=403,
                detail={
                    "allowed": False,
                    "used": used,
                    "limit": limit,
                    "remaining": 0,
                    "reset_at": reset_at,
                    "message": "Your image generation limit has been reached for today."
                }
            )
            
    prompt_encoded = urllib.parse.quote(request.prompt.strip())
    url = f"https://image.pollinations.ai/p/{prompt_encoded}?width=1024&height=1024&nologo=true"
    filename = f"gen-{str(uuid.uuid4())}.jpg"
    filepath = os.path.join(IMAGES_DIR, filename)
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, timeout=40.0)
        if res.status_code == 200:
            with open(filepath, "wb") as f:
                f.write(res.content)
            image_url = f"http://127.0.0.1:8000/static/generated_images/{filename}"
            
            chats = load_chats()
            active_chat = None
            for chat in chats:
                if chat["id"] == request.chat_id and chat.get("user_id") == user["sub"]:
                    active_chat = chat
                    break
            
            if not active_chat:
                active_chat = {
                    "id": request.chat_id,
                    "user_id": user["sub"],
                    "title": request.prompt[:25] + "..." if len(request.prompt) > 25 else request.prompt,
                    "messages": []
                }
                chats.insert(0, active_chat)
                
            user_msg = {
                "id": str(uuid.uuid4()),
                "sender": "user",
                "text": f"Generate image: {request.prompt}",
                "timestamp": datetime.datetime.now().isoformat()
            }
            active_chat["messages"].append(user_msg)
            
            bot_msg = {
                "id": str(uuid.uuid4()),
                "sender": "bot",
                "text": f"Here is the generated image for your prompt: \"{request.prompt}\"",
                "timestamp": datetime.datetime.now().isoformat(),
                "image_url": image_url
            }
            active_chat["messages"].append(bot_msg)
            
            if active_chat["title"] == "New Chat":
                active_chat["title"] = request.prompt[:25] + "..." if len(request.prompt) > 25 else request.prompt
                
            save_chats(chats)
            
            try:
                from app.notifications import create_notification_internal
                create_notification_internal(
                    user_id=user["sub"],
                    title="Image Generated 🎨",
                    message=f"Your image has been generated for prompt: \"{request.prompt}\".",
                    type="image_gen",
                    related_module=request.chat_id
                )
            except Exception as ne:
                print("Failed to dispatch image generation success notification:", ne)
                
            # Increment usage count only on successful completion
            async with usage_lock:
                usages = load_usages()
                record_found = False
                for record in usages:
                    if record.get("user_id") == user["sub"] and record.get("usage_type") == "image_generation" and record.get("period_start") == current_date:
                        record["count"] = record.get("count", 0) + 1
                        record["updated_at"] = datetime.datetime.utcnow().isoformat()
                        record_found = True
                        break
                if not record_found:
                    usages.append({
                        "user_id": user["sub"],
                        "usage_type": "image_generation",
                        "count": 1,
                        "period_type": "daily",
                        "period_start": current_date,
                        "period_end": current_date,
                        "plan": user_plan,
                        "created_at": datetime.datetime.utcnow().isoformat(),
                        "updated_at": datetime.datetime.utcnow().isoformat()
                    })
                save_usages(usages)
                
            return {"image_url": image_url}
        else:
            try:
                from app.notifications import create_notification_internal
                create_notification_internal(
                    user_id=user["sub"],
                    title="Image Generation Failed ❌",
                    message="Image generation failed. Tap to try again.",
                    type="image_gen",
                    related_module=request.chat_id
                )
            except Exception as ne:
                print("Failed to dispatch image generation failure notification:", ne)
            raise HTTPException(status_code=500, detail=f"Image provider returned error code: {res.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        try:
            from app.notifications import create_notification_internal
            create_notification_internal(
                user_id=user["sub"],
                title="Image Generation Failed ❌",
                message=f"Image generation failed: {str(e)}",
                type="image_gen",
                related_module=request.chat_id
            )
        except Exception as ne:
            print("Failed to dispatch image generation failure notification:", ne)
        raise HTTPException(status_code=500, detail=f"Failed to generate image: {str(e)}")

@app.post("/api/image/analyze")
async def analyze_image_endpoint(request: ImageAnalyzeRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        raise HTTPException(status_code=500, detail="Gemini API key is not configured.")
        
    prompt = request.prompt.strip() if request.prompt else "Describe this image in detail."
    
    b64_data = request.image_base64
    mime_type = "image/jpeg"
    if "," in b64_data:
        parts = b64_data.split(",")
        header = parts[0]
        b64_data = parts[1]
        if "image/" in header:
            mime_match = re.search(r'image/([^;]+)', header)
            if mime_match:
                mime_type = f"image/{mime_match.group(1)}"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
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
                        "text": prompt
                    }
                ]
            }
        ]
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=30.0)
        if response.status_code == 200:
            data = response.json()
            description = data["candidates"][0]["content"]["parts"][0]["text"]
            return {"description": description}
        else:
            raise HTTPException(status_code=response.status_code, detail=f"Gemini API returned error: {response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vision analysis failed: {str(e)}")

# --- Productivity APIs ---

class NoteSchema(BaseModel):
    title: str
    content: str
    pinned: bool = False

class TaskSchema(BaseModel):
    title: str
    priority: str = "medium"
    completed: bool = False

class ReminderSchema(BaseModel):
    title: str
    description: Optional[str] = None
    datetime: str
    repeat_type: str = "once" # once, daily, weekly, monthly, custom
    priority: str = "medium" # low, medium, high
    status: str = "upcoming" # upcoming, completed, missed
    completed: bool = False

NOTES_FILE = os.path.join(BASE_DIR, "app", "notes.json")
TASKS_FILE = os.path.join(BASE_DIR, "app", "tasks.json")
REMINDERS_FILE = os.path.join(BASE_DIR, "app", "reminders.json")

def load_notes():
    if not os.path.exists(NOTES_FILE):
        return []
    try:
        with open(NOTES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_notes(notes):
    try:
        with open(NOTES_FILE, "w", encoding="utf-8") as f:
            json.dump(notes, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save notes:", e)
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            async def _sync():
                for n in notes:
                    if n.get("id"):
                        doc = {k: v for k, v in n.items() if k != "_id"}
                        await notes_collection.update_one({"id": n["id"]}, {"$set": doc}, upsert=True)
            loop.create_task(_sync())
    except Exception:
        pass

def load_tasks():
    if not os.path.exists(TASKS_FILE):
        return []
    try:
        with open(TASKS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_tasks(tasks):
    try:
        with open(TASKS_FILE, "w", encoding="utf-8") as f:
            json.dump(tasks, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save tasks:", e)
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            async def _sync():
                for t in tasks:
                    if t.get("id"):
                        doc = {k: v for k, v in t.items() if k != "_id"}
                        await tasks_collection.update_one({"id": t["id"]}, {"$set": doc}, upsert=True)
            loop.create_task(_sync())
    except Exception:
        pass

def load_reminders():
    if not os.path.exists(REMINDERS_FILE):
        return []
    try:
        with open(REMINDERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_reminders(reminders):
    try:
        with open(REMINDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(reminders, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save reminders:", e)
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            async def _sync():
                for r in reminders:
                    if r.get("id"):
                        doc = {k: v for k, v in r.items() if k != "_id"}
                        await reminders_collection.update_one({"id": r["id"]}, {"$set": doc}, upsert=True)
            loop.create_task(_sync())
    except Exception:
        pass

# Notes CRUD Endpoints
@app.get("/api/notes")
async def get_notes(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    notes = await db_load_notes_for_user(user["sub"])
    return notes

@app.post("/api/notes")
async def create_note(req: NoteSchema, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    new_note = {
        "id": str(uuid.uuid4()),
        "user_id": user["sub"],
        "title": req.title,
        "content": req.content,
        "pinned": req.pinned,
        "created_at": datetime.datetime.now().isoformat(),
        "updated_at": datetime.datetime.now().isoformat()
    }
    await db_save_note(new_note)
    print(f"[DIAGNOSTIC] create_note for user_id={user['sub']}: note_id={new_note['id']}, title='{new_note['title']}'. Total notes in DB now: {len(notes)}.")
    try:
        from app.knowledge_engine import add_knowledge_entry
        add_knowledge_entry(
            user_id=user["sub"],
            title=f"Note: {req.title}",
            content=f"Note Title: {req.title}\nContent: {req.content}",
            type_name="note",
            related_module=new_note["id"],
            metadata={"note_id": new_note["id"]}
        )
    except Exception as ke:
        print("Failed to index note in knowledge engine:", ke)
    return new_note

@app.put("/api/notes/{note_id}")
async def update_note(note_id: str, req: NoteSchema, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    notes = await db_load_notes_for_user(user["sub"])
    for n in notes:
        if n["id"] == note_id and n["user_id"] == user["sub"]:
            n["title"] = req.title
            n["content"] = req.content
            n["pinned"] = req.pinned
            n["updated_at"] = datetime.datetime.now().isoformat()
            await db_save_note(n)
            return n
    raise HTTPException(status_code=404, detail="Note not found")

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    deleted = await db_delete_note(note_id, user["sub"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"status": "success", "message": "Note deleted"}

# Tasks CRUD Endpoints
@app.get("/api/tasks")
async def get_tasks(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    tasks = await db_load_tasks_for_user(user["sub"])
    return tasks

@app.post("/api/tasks")
async def create_task(req: TaskSchema, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    new_task = {
        "id": str(uuid.uuid4()),
        "user_id": user["sub"],
        "title": req.title,
        "priority": req.priority,
        "completed": req.completed,
        "created_at": datetime.datetime.now().isoformat()
    }
    await db_save_task(new_task)
    try:
        from app.knowledge_engine import add_knowledge_entry
        add_knowledge_entry(
            user_id=user["sub"],
            title=f"Task: {req.title}",
            content=f"Task Title: {req.title}\nPriority: {req.priority}\nStatus: {'Completed' if req.completed else 'Pending'}",
            type_name="task",
            related_module=new_task["id"],
            metadata={"task_id": new_task["id"], "priority": req.priority, "completed": req.completed}
        )
    except Exception as ke:
        print("Failed to index task in knowledge engine:", ke)
    try:
        from app.notifications import create_notification_internal
        create_notification_internal(
            user_id=user["sub"],
            title="Task Created 📋",
            message=f"New task created: '{req.title}'",
            type="task",
            related_module="tasks"
        )
    except Exception as ne:
        print("Failed to dispatch task notification:", ne)
    return new_task

@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, req: TaskSchema, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    tasks = await db_load_tasks_for_user(user["sub"])
    for t in tasks:
        if t["id"] == task_id and t["user_id"] == user["sub"]:
            was_completed = t.get("completed", False)
            t["title"] = req.title
            t["priority"] = req.priority
            t["completed"] = req.completed
            await db_save_task(t)
            
            try:
                from app.notifications import create_notification_internal
                if not was_completed and req.completed:
                    create_notification_internal(
                        user_id=user["sub"],
                        title="Task Completed ✅",
                        message=f"Task completed: '{req.title}'.",
                        type="task",
                        related_module="tasks"
                    )
                else:
                    create_notification_internal(
                        user_id=user["sub"],
                        title="Task Updated 📋",
                        message=f"Task updated: '{req.title}'.",
                        type="task",
                        related_module="tasks"
                    )
            except Exception as ne:
                print("Failed to dispatch task update/completion notification:", ne)
                
            return t
    raise HTTPException(status_code=404, detail="Task not found")

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    deleted = await db_delete_task(task_id, user["sub"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "success", "message": "Task deleted"}

# Reminders CRUD Endpoints
@app.get("/api/reminders")
async def get_reminders(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    reminders = await db_load_reminders_for_user(user["sub"])
    return reminders

@app.post("/api/reminders")
async def create_reminder(req: ReminderSchema, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    # Validate scheduled time is in the future
    try:
        rem_dt = datetime.datetime.fromisoformat(req.datetime)
        if rem_dt < datetime.datetime.now():
            raise HTTPException(status_code=400, detail="Cannot schedule reminder in the past.")
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid date & time format.")

    new_reminder = {
        "id": str(uuid.uuid4()),
        "user_id": user["sub"],
        "title": req.title,
        "description": req.description,
        "datetime": req.datetime,
        "repeat_type": req.repeat_type,
        "priority": req.priority,
        "status": req.status,
        "completed": req.completed,
        "created_at": datetime.datetime.now().isoformat(),
        "updated_at": datetime.datetime.now().isoformat()
    }
    await db_save_reminder(new_reminder)
    try:
        from app.knowledge_engine import add_knowledge_entry
        add_knowledge_entry(
            user_id=user["sub"],
            title=f"Reminder: {req.title}",
            content=f"Reminder Title: {req.title}\nDescription: {req.description}\nTime: {req.datetime}\nRepeat: {req.repeat_type}\nPriority: {req.priority}",
            type_name="reminder",
            related_module=new_reminder["id"],
            metadata={"reminder_id": new_reminder["id"]}
        )
    except Exception as ke:
        print("Failed to index reminder in knowledge engine:", ke)
    try:
        from app.notifications import create_notification_internal
        create_notification_internal(
            user_id=user["sub"],
            title="Reminder Created ⏰",
            message="Reminder created successfully.",
            type="reminder",
            related_module=new_reminder["id"]
        )
    except Exception as ne:
        print("Failed to dispatch reminder notification:", ne)
    return new_reminder

@app.put("/api/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, req: ReminderSchema, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    reminders = load_reminders()
    for r in reminders:
        if r["id"] == reminder_id and r["user_id"] == user["sub"]:
            if r.get("datetime") != req.datetime:
                try:
                    rem_dt = datetime.datetime.fromisoformat(req.datetime)
                    if rem_dt < datetime.datetime.now():
                        raise HTTPException(status_code=400, detail="Cannot schedule reminder in the past.")
                except HTTPException as he:
                    raise he
                except Exception as e:
                    raise HTTPException(status_code=400, detail="Invalid date & time format.")
            
            r["title"] = req.title
            r["description"] = req.description
            r["datetime"] = req.datetime
            r["repeat_type"] = req.repeat_type
            r["priority"] = req.priority
            r["status"] = req.status
            r["completed"] = req.completed
            r["updated_at"] = datetime.datetime.now().isoformat()
            save_reminders(reminders)
            return r
    raise HTTPException(status_code=404, detail="Reminder not found")

@app.delete("/api/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    deleted = await db_delete_reminder(reminder_id, user["sub"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"status": "success", "message": "Reminder deleted"}

import asyncio
import calendar

async def check_and_trigger_due_reminders():
    # 1. Reminders check
    reminders = load_reminders()
    now = datetime.datetime.now()
    updated = False
    
    for r in reminders:
        if r.get("status", "upcoming") == "upcoming":
            try:
                rem_dt = datetime.datetime.fromisoformat(r["datetime"])
                diff = rem_dt - now
                diff_minutes = diff.total_seconds() / 60.0
                
                # Check overdue, due now, and coming soon
                if diff_minutes <= -10:
                    if not r.get("notified_overdue", False):
                        from app.notifications import create_notification_internal
                        create_notification_internal(
                            user_id=r["user_id"],
                            title="Reminder Overdue ⚠️",
                            message=f"Missed reminder: '{r['title']}' was scheduled for {r['datetime']}.",
                            type="reminder",
                            related_module=r["id"],
                            priority="normal"
                        )
                        r["notified_overdue"] = True
                        r["notified_due"] = True
                        updated = True
                elif diff_minutes <= 0:
                    if not r.get("notified_due", False):
                        from app.notifications import create_notification_internal
                        create_notification_internal(
                            user_id=r["user_id"],
                            title="Reminder Due Alert ⏰",
                            message=f"Your '{r['title']}' reminder is due now.",
                            type="reminder",
                            related_module=r["id"],
                            priority="normal"
                        )
                        r["notified_due"] = True
                        updated = True
                elif diff_minutes <= 15:
                    if not r.get("notified_soon", False):
                        from app.notifications import create_notification_internal
                        create_notification_internal(
                            user_id=r["user_id"],
                            title="Reminder Coming Soon ⏳",
                            message=f"Reminder approaching: '{r['title']}' is due in {int(diff_minutes)} minutes.",
                            type="reminder",
                            related_module=r["id"],
                            priority="normal"
                        )
                        r["notified_soon"] = True
                        updated = True
                        
                # If actually triggered (due), update recurrence/status
                if rem_dt <= now:
                    rep = r.get("repeat_type", "once").lower()
                    if rep == "once":
                        r["status"] = "missed"
                        r["completed"] = False
                    elif rep == "daily":
                        next_dt = rem_dt + datetime.timedelta(days=1)
                        r["datetime"] = next_dt.isoformat()
                        r["notified"] = False
                        r["notified_soon"] = False
                        r["notified_due"] = False
                        r["notified_overdue"] = False
                    elif rep == "weekly":
                        next_dt = rem_dt + datetime.timedelta(weeks=1)
                        r["datetime"] = next_dt.isoformat()
                        r["notified"] = False
                        r["notified_soon"] = False
                        r["notified_due"] = False
                        r["notified_overdue"] = False
                    elif rep == "monthly":
                        month = rem_dt.month
                        year = rem_dt.year
                        if month == 12:
                            month = 1
                            year += 1
                        else:
                            month += 1
                        max_days = calendar.monthrange(year, month)[1]
                        day = min(rem_dt.day, max_days)
                        next_dt = rem_dt.replace(year=year, month=month, day=day)
                        r["datetime"] = next_dt.isoformat()
                        r["notified"] = False
                        r["notified_soon"] = False
                        r["notified_due"] = False
                        r["notified_overdue"] = False
                        
                    r["updated_at"] = datetime.datetime.now().isoformat()
                    updated = True
            except Exception as ex:
                print(f"Error checking background reminder {r.get('id')}: {ex}")
                
    if updated:
        save_reminders(reminders)
        
    # 2. Tasks check
    tasks = load_tasks()
    tasks_updated = False
    for t in tasks:
        if t.get("completed", False):
            continue
        due_str = t.get("due_date")
        if not due_str:
            created_str = t.get("created_at")
            if created_str:
                try:
                    created_dt = datetime.datetime.fromisoformat(created_str)
                    due_dt = created_dt + datetime.timedelta(days=1)
                    t["due_date"] = due_dt.isoformat()
                    due_str = t["due_date"]
                    tasks_updated = True
                except:
                    pass
        if due_str:
            try:
                due_dt = datetime.datetime.fromisoformat(due_str)
                diff = due_dt - now
                diff_minutes = diff.total_seconds() / 60.0
                
                # Check overdue and due soon
                if diff_minutes <= 0:
                    if not t.get("notified_overdue", False):
                        from app.notifications import create_notification_internal
                        create_notification_internal(
                            user_id=t["user_id"],
                            title="Task Overdue ⚠️",
                            message=f"Your task '{t['title']}' is overdue.",
                            type="task",
                            related_module="tasks",
                            priority="normal"
                        )
                        t["notified_overdue"] = True
                        t["notified_due_soon"] = True
                        tasks_updated = True
                elif diff_minutes <= 1440:
                    if not t.get("notified_due_soon", False):
                        from app.notifications import create_notification_internal
                        create_notification_internal(
                            user_id=t["user_id"],
                            title="Task Due Soon ⏳",
                            message=f"Your task '{t['title']}' is due tomorrow.",
                            type="task",
                            related_module="tasks",
                            priority="normal"
                        )
                        t["notified_due_soon"] = True
                        tasks_updated = True
            except Exception as ex:
                print(f"Error checking background task {t.get('id')}: {ex}")
                
    if tasks_updated:
        save_tasks(tasks)

async def check_reminders_periodically():
    while True:
        try:
            await check_and_trigger_due_reminders()
        except Exception as e:
            print("Background check reminders error:", e)
        await asyncio.sleep(20)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(check_reminders_periodically())
    # Promote INITIAL_ADMIN_EMAIL to admin (defaults to manisha61232752@gmail.com)
    admin_email = os.getenv("INITIAL_ADMIN_EMAIL", "manisha61232752@gmail.com").strip().lower()
    if admin_email:
        users = load_users()
        modified = False
        for u in users:
            if u["email"] == admin_email:
                if u.get("role") != "admin":
                    u["role"] = "admin"
                    modified = True
                    print(f"Bootstrapping admin role for user: {admin_email}")
        if modified:
            save_users(users)



# --- ADMIN ACCESS CONTROL DEPENDENCY ---
async def verify_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = await get_current_user(authorization)
    users = load_users()
    for u in users:
        if u["id"] == user["sub"]:
            if u.get("role", "user") == "admin":
                return u
            break
    raise HTTPException(status_code=403, detail="Forbidden: Admin access required.")

# --- ADMIN HELPER FUNCTIONS ---
AUDIT_LOGS_FILE = os.path.join(BASE_DIR, "app", "audit_logs.json")
SYSTEM_SETTINGS_FILE = os.path.join(BASE_DIR, "app", "system_settings.json")
SYSTEM_ERRORS_FILE = os.path.join(BASE_DIR, "app", "system_errors.json")

def load_documents():
    DOCUMENTS_FILE = os.path.join(BASE_DIR, "app", "documents.json")
    if not os.path.exists(DOCUMENTS_FILE):
        return []
    try:
        with open(DOCUMENTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def load_notifications():
    NOTIFICATIONS_FILE = os.path.join(BASE_DIR, "app", "notifications.json")
    if not os.path.exists(NOTIFICATIONS_FILE):
        return []
    try:
        with open(NOTIFICATIONS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def load_audit_logs():
    if not os.path.exists(AUDIT_LOGS_FILE):
        return []
    try:
        with open(AUDIT_LOGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_audit_logs(logs):
    try:
        with open(AUDIT_LOGS_FILE, "w", encoding="utf-8") as f:
            json.dump(logs, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save audit logs:", e)

def log_audit_action(action: str, performed_by: str, details: str, target_user_id: Optional[str] = None):
    logs = load_audit_logs()
    entry = {
        "id": f"log-{str(uuid.uuid4())}",
        "timestamp": datetime.datetime.now().isoformat(),
        "action": action,
        "performed_by": performed_by,
        "details": details,
        "target_user_id": target_user_id
    }
    logs.insert(0, entry)
    save_audit_logs(logs)

def load_system_settings():
    default_settings = {
        "maintenance_mode": False,
        "allow_new_registrations": True,
        "default_token_limit": 5000,
        "google_oauth_enabled": True,
        "ai_model_version": "gemini-2.0-flash"
    }
    if not os.path.exists(SYSTEM_SETTINGS_FILE):
        return default_settings
    try:
        with open(SYSTEM_SETTINGS_FILE, "r", encoding="utf-8") as f:
            return {**default_settings, **json.load(f)}
    except:
        return default_settings

def save_system_settings(settings):
    try:
        with open(SYSTEM_SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save system settings:", e)

def load_system_errors():
    if not os.path.exists(SYSTEM_ERRORS_FILE):
        return [
            {
                "id": "err-1",
                "timestamp": (datetime.datetime.now() - datetime.timedelta(hours=2)).isoformat(),
                "error_type": "GeminiAPIWarning",
                "message": "Quota limit reached for model gemini-2.0-flash. Switched to Local Fallback Mode.",
                "status": "unresolved"
            }
        ]
    try:
        with open(SYSTEM_ERRORS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_system_errors(errors):
    try:
        with open(SYSTEM_ERRORS_FILE, "w", encoding="utf-8") as f:
            json.dump(errors, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to save system errors:", e)

# --- ADMIN ROUTER ENDPOINTS ---
@app.get("/api/admin/stats")
async def get_admin_stats(admin_user: dict = Depends(verify_admin)):
    users = load_users()
    chats = load_chats()
    documents = load_documents()
    notifications = load_notifications()
    errors = load_system_errors()
    
    temp_uploads_count = 0
    temp_uploads_size = 0
    if os.path.exists(TEMP_UPLOAD_DIR):
        for f in os.listdir(TEMP_UPLOAD_DIR):
            fp = os.path.join(TEMP_UPLOAD_DIR, f)
            if os.path.isfile(fp):
                temp_uploads_count += 1
                temp_uploads_size += os.path.getsize(fp)
                
    generated_images_count = 0
    if os.path.exists(IMAGES_DIR):
        for f in os.listdir(IMAGES_DIR):
            fp = os.path.join(IMAGES_DIR, f)
            if os.path.isfile(fp):
                generated_images_count += 1
                
    roles_distribution = {"user": 0, "admin": 0}
    for u in users:
        role = u.get("role", "user")
        roles_distribution[role] = roles_distribution.get(role, 0) + 1
        
    plans_distribution = {"FREE": 0, "PLUS": 0, "PRO": 0}
    for u in users:
        plan = get_user_active_plan(u["id"])
        plans_distribution[plan] = plans_distribution.get(plan, 0) + 1
            
    total_messages = sum(len(session.get("messages", [])) for session in chats)
    
    return {
        "users_count": len(users),
        "roles_distribution": roles_distribution,
        "plans_distribution": plans_distribution,
        "chats_count": len(chats),
        "messages_count": total_messages,
        "documents_count": len(documents),
        "notifications_count": len(notifications),
        "temp_uploads_count": temp_uploads_count,
        "temp_uploads_size_bytes": temp_uploads_size,
        "generated_images_count": generated_images_count,
        "system_errors_count": len([e for e in errors if e.get("status") == "unresolved"])
    }

@app.get("/api/admin/users")
async def get_admin_users(admin_user: dict = Depends(verify_admin)):
    users = load_users()
    return [
        {
            "id": u["id"],
            "name": u["name"],
            "email": u["email"],
            "role": u.get("role", "user"),
            "account_type": get_user_active_plan(u["id"]),
            "member_since": u.get("member_since", "")
        }
        for u in users
    ]

@app.put("/api/admin/users/{user_id}/role")
async def update_user_role(user_id: str, req: dict, admin_user: dict = Depends(verify_admin)):
    new_role = req.get("role")
    if new_role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role specified.")
        
    if user_id == admin_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot demote yourself.")
        
    users = load_users()
    for u in users:
        if u["id"] == user_id:
            old_role = u.get("role", "user")
            u["role"] = new_role
            save_users(users)
            log_audit_action(
                action="USER_ROLE_CHANGE",
                performed_by=admin_user["email"],
                details=f"Changed user role for {u['email']} from '{old_role}' to '{new_role}'.",
                target_user_id=user_id
            )
            return {"status": "success", "message": f"User role updated to {new_role}"}
            
    raise HTTPException(status_code=404, detail="User not found.")

@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: str, admin_user: dict = Depends(verify_admin)):
    if user_id == admin_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete yourself.")
        
    users = load_users()
    filtered_users = [u for u in users if u["id"] != user_id]
    if len(filtered_users) == len(users):
        raise HTTPException(status_code=404, detail="User not found.")
        
    deleted_user_email = next(u["email"] for u in users if u["id"] == user_id)
    save_users(filtered_users)
    log_audit_action(
        action="USER_DELETE",
        performed_by=admin_user["email"],
        details=f"Deleted user account: {deleted_user_email}.",
        target_user_id=user_id
    )
    return {"status": "success", "message": "User account successfully deleted"}

@app.post("/api/admin/announcement")
async def create_announcement(req: dict, admin_user: dict = Depends(verify_admin)):
    title = req.get("title", "").strip()
    message = req.get("message", "").strip()
    priority = req.get("priority", "normal")
    
    if not title or not message:
        raise HTTPException(status_code=400, detail="Title and message are required.")
        
    users = load_users()
    count = 0
    from app.notifications import create_notification_internal
    
    for u in users:
        create_notification_internal(
            user_id=u["id"],
            title=title,
            message=message,
            type="assistant_updates",
            priority=priority
        )
        count += 1
        
    log_audit_action(
        action="ANNOUNCEMENT_CREATE",
        performed_by=admin_user["email"],
        details=f"Sent system announcement '{title}' to {count} users."
    )
    return {"status": "success", "message": f"Announcement sent to {count} users."}

@app.get("/api/admin/audit-logs")
async def get_audit_logs(admin_user: dict = Depends(verify_admin)):
    return load_audit_logs()

@app.get("/api/admin/settings")
async def get_admin_settings(admin_user: dict = Depends(verify_admin)):
    return load_system_settings()

@app.put("/api/admin/settings")
async def update_admin_settings(req: dict, admin_user: dict = Depends(verify_admin)):
    settings = load_system_settings()
    for k, v in req.items():
        if k in settings:
            settings[k] = v
    save_system_settings(settings)
    log_audit_action(
        action="SYSTEM_SETTINGS_UPDATE",
        performed_by=admin_user["email"],
        details=f"Updated system settings keys: {list(req.keys())}."
    )
    return {"status": "success", "settings": settings}




@app.get("/api/admin/errors")
async def get_admin_errors(admin_user: dict = Depends(verify_admin)):
    return load_system_errors()

@app.post("/api/admin/errors/clear")
async def clear_admin_errors(admin_user: dict = Depends(verify_admin)):
    save_system_errors([])
    log_audit_action(
        action="SYSTEM_ERRORS_CLEAR",
        performed_by=admin_user["email"],
        details="Cleared system error logs."
    )
    return {"status": "success", "message": "Error logs cleared"}

@app.post("/api/admin/errors/simulate")
async def simulate_admin_error(req: dict, admin_user: dict = Depends(verify_admin)):
    err_type = req.get("error_type", "SystemWarning")
    msg = req.get("message", "A test simulated warning message.")
    errors = load_system_errors()
    entry = {
        "id": f"err-{str(uuid.uuid4())[:8]}",
        "timestamp": datetime.datetime.now().isoformat(),
        "error_type": err_type,
        "message": msg,
        "status": "unresolved"
    }
    errors.insert(0, entry)
    save_system_errors(errors)
    return {"status": "success", "error": entry}

@app.get("/api/admin/subscription/config")
async def get_admin_subscription_config(admin_user: dict = Depends(verify_admin)):
    return load_subscription_config()

@app.post("/api/admin/subscription/config")
async def update_admin_subscription_config(req: dict, admin_user: dict = Depends(verify_admin)):
    # Validate fields
    plan_name = req.get("plan_name")
    monthly_price = req.get("monthly_price")
    trial_duration = req.get("trial_duration")
    promo_price = req.get("promo_price")
    offer_heading = req.get("offer_heading")
    offer_description = req.get("offer_description")
    features = req.get("features")
    
    if not plan_name or not isinstance(plan_name, str) or not plan_name.strip():
        raise HTTPException(status_code=400, detail="Plan Name must be a non-empty string.")
        
    if monthly_price is None or not isinstance(monthly_price, (int, float)) or monthly_price <= 0:
        raise HTTPException(status_code=400, detail="Monthly Price must be a positive number.")
        
    if trial_duration is None or not isinstance(trial_duration, str) or not trial_duration.strip():
        raise HTTPException(status_code=400, detail="Trial Duration must be a non-empty string.")
        
    if promo_price is None or not isinstance(promo_price, (int, float)) or promo_price < 0:
        raise HTTPException(status_code=400, detail="Promotional Price must be a non-negative number.")
        
    if not offer_heading or not isinstance(offer_heading, str) or not offer_heading.strip():
        raise HTTPException(status_code=400, detail="Offer Heading must be a non-empty string.")
        
    if not isinstance(features, list) or len(features) == 0 or not all(isinstance(f, str) and f.strip() for f in features):
        raise HTTPException(status_code=400, detail="Features list must contain at least one non-empty string feature.")
        
    old_config = load_subscription_config()
    new_config = {
        "plan_name": plan_name.strip(),
        "monthly_price": int(monthly_price),
        "trial_enabled": bool(req.get("trial_enabled", True)),
        "trial_duration": trial_duration.strip(),
        "promo_price": int(promo_price),
        "offer_heading": offer_heading.strip(),
        "offer_description": (offer_description or "").strip(),
        "after_trial_price": f"₹{int(monthly_price)}/month",
        "features": [f.strip() for f in features],
        "offer_active": bool(req.get("offer_active", True)),
        "updated_at": datetime.datetime.now().isoformat(),
        "updated_by": admin_user["id"]
    }
    
    # Identify changed fields
    changed_fields = {}
    for k, v in new_config.items():
        if k in ["updated_at", "updated_by"]:
            continue
        old_val = old_config.get(k)
        if old_val != v:
            changed_fields[k] = {"old": old_val, "new": v}
            
    save_subscription_config(new_config)
    
    if changed_fields:
        log_audit_action(
            action="UPDATE_SUBSCRIPTION_CONFIG",
            performed_by=admin_user["email"],
            details=f"Updated subscription configuration. Changed fields: {json.dumps(changed_fields, ensure_ascii=False)}"
        )
        
    return {"status": "success", "message": "Subscription settings updated successfully.", "config": new_config}


@app.get("/api/health/ai")
async def ai_health_diagnostics():
    from app.services.ai_provider import global_health_tracker
    health_status = global_health_tracker.get_status()
    
    return {
        "status": "healthy" if health_status.get("gemini", {}).get("healthy", True) else "degraded",
        "primary_provider": {
            "name": settings.AI_PRIMARY_PROVIDER,
            "model": settings.GEMINI_MODEL,
            "key_configured": bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "YOUR_GEMINI_API_KEY_HERE"),
            "health": health_status.get("gemini", {})
        },
        "fallback_provider": {
            "name": settings.AI_FALLBACK_PROVIDER or "none",
            "model": settings.FALLBACK_MODEL if settings.AI_FALLBACK_PROVIDER else "none",
            "configured": bool(settings.AI_FALLBACK_PROVIDER and settings.FALLBACK_API_KEY),
            "key_configured": bool(settings.FALLBACK_API_KEY),
            "health": health_status.get("fallback", {})
        },
        "resilience_settings": {
            "max_retries": settings.AI_MAX_RETRIES,
            "request_timeout_seconds": settings.AI_REQUEST_TIMEOUT_SECONDS,
            "cooldown_seconds": settings.AI_PROVIDER_COOLDOWN_SECONDS,
            "cache_enabled": settings.AI_CACHE_ENABLED,
            "cache_ttl_seconds": settings.AI_CACHE_TTL_SECONDS
        }
    }


