import re
import urllib.parse
import httpx
import os
import uuid
import calendar
import datetime
import json

def clean_math_expression(expr: str) -> str:
    # Strictly allow only: digits, spaces, decimal dots, and math operators
    return "".join(c for c in expr if c.isdigit() or c in "+-*/().* ")

async def run_tool(query: str, images_dir: str) -> dict:
    """
    Check if the user request matches any built-in tool.
    If matched, executes the tool and returns a dictionary:
    {
       "name": str,
       "input": str,
       "output": str,
       "type": str  # 'text' | 'html' | 'image' | 'json' | 'chart'
    }
    If no tool matches, returns None.
    """
    q_clean = query.strip()
    if not q_clean:
        return None

    # 1. Date & Time Tool
    time_queries = ["what time is it", "current date", "today's date", "current time", "what date is today"]
    if any(t in q_clean.lower() for t in time_queries):
        now = datetime.datetime.now()
        output_str = now.strftime("%A, %B %d, %Y • %I:%M:%S %p")
        return {
            "name": "Date & Time",
            "input": "Check current system time",
            "output": output_str,
            "type": "text"
        }

    # 2. Calendar Tool
    # matches: calendar for august 2026, calendar 2026, show calendar august 2026
    cal_match = re.search(r'calendar\s+(?:for\s+)?(?:(\w+)\s+)?(\d{4})', q_clean, re.IGNORECASE)
    if cal_match:
        month_name = cal_match.group(1)
        year = int(cal_match.group(2))
        
        month_map = {
            "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
            "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
        }
        month = 1
        if month_name:
            month = month_map.get(month_name.lower(), 1)
        try:
            html_cal = calendar.HTMLCalendar().formatmonth(year, month)
            # Add dynamic CSS classes
            styled_cal = f"<div class='calendar-tool-card'>{html_cal}</div>"
            return {
                "name": "Calendar",
                "input": f"Calendar for {month_name or 'January'} {year}",
                "output": styled_cal,
                "type": "html"
            }
        except Exception as e:
            return {
                "name": "Calendar",
                "input": q_clean,
                "output": f"Failed to generate calendar: {e}",
                "type": "text"
            }

    # 3. QR Code Generator Tool
    qr_match = re.search(r'(?:generate\s+)?qr\s+code\s+(?:for\s+)?(.+)', q_clean, re.IGNORECASE)
    if qr_match:
        data = qr_match.group(1).strip()
        data_encoded = urllib.parse.quote(data)
        url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={data_encoded}"
        filename = f"qr-{str(uuid.uuid4())}.png"
        filepath = os.path.join(images_dir, filename)
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, timeout=15.0)
            if res.status_code == 200:
                with open(filepath, "wb") as f:
                    f.write(res.content)
                image_url = f"http://127.0.0.1:8000/static/generated_images/{filename}"
                return {
                    "name": "QR Code Generator",
                    "input": data,
                    "output": image_url,
                    "type": "image"
                }
        except Exception as e:
            return {
                "name": "QR Code Generator",
                "input": data,
                "output": f"Failed to contact QR service: {e}",
                "type": "text"
            }

    # 4. Barcode Generator Tool
    barcode_match = re.search(r'(?:generate\s+)?barcode\s+(?:for\s+)?(.+)', q_clean, re.IGNORECASE)
    if barcode_match:
        data = barcode_match.group(1).strip()
        data_encoded = urllib.parse.quote(data)
        url = f"https://barcode.tec-it.com/barcode.ashx?data={data_encoded}&code=Code128"
        filename = f"bc-{str(uuid.uuid4())}.png"
        filepath = os.path.join(images_dir, filename)
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, timeout=15.0)
            if res.status_code == 200:
                with open(filepath, "wb") as f:
                    f.write(res.content)
                image_url = f"http://127.0.0.1:8000/static/generated_images/{filename}"
                return {
                    "name": "Barcode Generator",
                    "input": data,
                    "output": image_url,
                    "type": "image"
                }
        except Exception as e:
            return {
                "name": "Barcode Generator",
                "input": data,
                "output": f"Failed to contact barcode service: {e}",
                "type": "text"
            }

    # 5. Currency Converter Tool
    # matches: convert 100 USD to EUR, currency converter 50 gbp to usd
    curr_match = re.search(r'(?:convert|converter)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]{3})\s*to\s*([a-zA-Z]{3})', q_clean, re.IGNORECASE)
    if curr_match:
        val = float(curr_match.group(1))
        from_curr = curr_match.group(2).upper()
        to_curr = curr_match.group(3).upper()
        usd_rates = {
            "USD": 1.0, "EUR": 0.92, "GBP": 0.78, "INR": 83.2,
            "JPY": 155.0, "CAD": 1.36, "AUD": 1.51, "CNY": 7.24
        }
        if from_curr in usd_rates and to_curr in usd_rates:
            val_usd = val / usd_rates[from_curr]
            res = val_usd * usd_rates[to_curr]
            return {
                "name": "Currency Converter",
                "input": f"{val} {from_curr} ➔ {to_curr}",
                "output": f"{val} {from_curr} = {res:.2f} {to_curr} (USD base exchange mockup)",
                "type": "text"
            }

    # 6. Unit Converter Tool
    # matches: convert 5 miles to km, convert 100 kg to lbs
    unit_match = re.search(r'convert\s+(\d+(?:\.\d+)?)\s*(\w+)\s*to\s*(\w+)', q_clean, re.IGNORECASE)
    if unit_match:
        val = float(unit_match.group(1))
        from_unit = unit_match.group(2).lower()
        to_unit = unit_match.group(3).lower()
        conversions = {
            ("miles", "km"): val * 1.60934,
            ("km", "miles"): val / 1.60934,
            ("kg", "lbs"): val * 2.20462,
            ("lbs", "kg"): val / 2.20462,
            ("celsius", "fahrenheit"): (val * 9/5) + 32,
            ("fahrenheit", "celsius"): (val - 32) * 5/9,
            ("c", "f"): (val * 9/5) + 32,
            ("f", "c"): (val - 32) * 5/9,
            ("meters", "feet"): val * 3.28084,
            ("feet", "meters"): val / 3.28084,
            ("inches", "cm"): val * 2.54,
            ("cm", "inches"): val / 2.54
        }
        key = (from_unit, to_unit)
        if key in conversions:
            res = conversions[key]
            return {
                "name": "Unit Converter",
                "input": f"{val} {from_unit} ➔ {to_unit}",
                "output": f"{val} {from_unit} = {res:.4f} {to_unit}",
                "type": "text"
            }

    # 7. Calculator Tool
    # matches: calculate (12 * 45) / 3 or raw arithmetic expressions
    calc_match = re.search(r'^(?:calculate|compute|eval)\s+([\d\s\+\-\*\/\(\)\.\*\*]+)$', q_clean, re.IGNORECASE)
    math_expr = None
    if calc_match:
        math_expr = calc_match.group(1)
    else:
        # Check if entire query is just numbers, spaces, dots, and math operators
        if re.match(r'^[\d\s\+\-\*\/\(\)\.\*\*]+$', q_clean) and any(op in q_clean for op in ["+", "-", "*", "/"]):
            math_expr = q_clean

    if math_expr:
        sanitized = clean_math_expression(math_expr)
        if sanitized.strip():
            try:
                res = eval(sanitized, {"__builtins__": None}, {})
                return {
                    "name": "Calculator",
                    "input": sanitized.strip(),
                    "output": str(res),
                    "type": "text"
                }
            except Exception as e:
                return {
                    "name": "Calculator",
                    "input": sanitized.strip(),
                    "output": f"Math Error: {e}",
                    "type": "text"
                }

    # 8. JSON Formatter Tool
    if "format json" in q_clean.lower() or "prettify json" in q_clean.lower() or "json formatter" in q_clean.lower():
        block_match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', q_clean)
        if block_match:
            json_str = block_match.group(1)
            try:
                parsed = json.loads(json_str)
                formatted = json.dumps(parsed, indent=2)
                return {
                    "name": "JSON Formatter",
                    "input": "Format JSON string",
                    "output": f"```json\n{formatted}\n```",
                    "type": "json"
                }
            except Exception as e:
                return {
                    "name": "JSON Formatter",
                    "input": "Format JSON string",
                    "output": f"Failed to format JSON (invalid structure): {e}",
                    "type": "text"
                }

    # 9. Markdown Renderer Tool
    if "render markdown" in q_clean.lower() or "preview markdown" in q_clean.lower():
        content_match = re.search(r'(?:render|preview)\s+markdown\s*([\s\S]*)', q_clean, re.IGNORECASE)
        if content_match:
            md_text = content_match.group(1).strip()
            if md_text:
                # Convert basic headers, bold, bullets
                html_out = md_text.replace("\n", "<br>")
                html_out = re.sub(r'#\s*(.+)', r'<h1>\1</h1>', html_out)
                html_out = re.sub(r'##\s*(.+)', r'<h2>\1</h2>', html_out)
                html_out = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html_out)
                return {
                    "name": "Markdown Renderer",
                    "input": "Render markdown to HTML",
                    "output": html_out,
                    "type": "html"
                }

    # 10. Code Formatter Tool
    if "format code" in q_clean.lower() or "code formatter" in q_clean.lower():
        code_match = re.search(r'(?:format\s+)?code(?:\s+formatter)?\s*([\s\S]*)', q_clean, re.IGNORECASE)
        if code_match:
            raw_code = code_match.group(1).strip()
            if raw_code:
                # Basic code indent clean logic
                lines = [line.strip() for line in raw_code.split("\n")]
                formatted_lines = []
                indent = 0
                for line in lines:
                    if line.endswith("}") or line.endswith("]"):
                        indent = max(0, indent - 1)
                    formatted_lines.append("    " * indent + line)
                    if line.endswith("{") or line.endswith("[") or line.endswith(":"):
                        indent += 1
                formatted_code = "\n".join(formatted_lines)
                return {
                    "name": "Code Formatter",
                    "input": "Format indents",
                    "output": f"```python\n{formatted_code}\n```",
                    "type": "text"
                }

    # 11. Table Generator Tool
    # matches: generate table for A, B, C \n 1, 2, 3
    if "generate table" in q_clean.lower() or "create table" in q_clean.lower():
        content_match = re.search(r'(?:generate|create|make)\s+(?:a\s+)?table\s+(?:of|for)\s*([\s\S]*)', q_clean, re.IGNORECASE)
        if content_match:
            raw_csv = content_match.group(1).strip()
            if raw_csv:
                lines = [line.strip() for line in raw_csv.split("\n") if line.strip()]
                if lines:
                    headers = [h.strip() for h in lines[0].split(",")]
                    markdown_table = "| " + " | ".join(headers) + " |\n"
                    markdown_table += "| " + " | ".join(["---"] * len(headers)) + " |\n"
                    for line in lines[1:]:
                        cells = [c.strip() for c in line.split(",")]
                        if len(cells) < len(headers):
                            cells += [""] * (len(headers) - len(cells))
                        markdown_table += "| " + " | ".join(cells[:len(headers)]) + " |\n"
                    return {
                        "name": "Table Generator",
                        "input": "Convert comma separated list to markdown table",
                        "output": markdown_table,
                        "type": "text"
                    }

    # 12. Chart Generator Tool
    # matches: generate chart for A: 10, B: 20, C: 15
    if "generate chart" in q_clean.lower() or "create chart" in q_clean.lower():
        content_match = re.search(r'(?:generate|create|make)\s+(?:a\s+)?chart\s+(?:of|for)\s*([\s\S]*)', q_clean, re.IGNORECASE)
        if content_match:
            raw_data = content_match.group(1).strip()
            if raw_data:
                items = re.findall(r'([^:,]+)\s*:\s*(\d+(?:\.\d+)?)', raw_data)
                if items:
                    labels = [item[0].strip() for item in items]
                    values = [float(item[1]) for item in items]
                    chart_data = {
                        "labels": labels,
                        "values": values
                    }
                    return {
                        "name": "Chart Generator",
                        "input": raw_data,
                        "output": json.dumps(chart_data),
                        "type": "chart"
                    }

    return None
