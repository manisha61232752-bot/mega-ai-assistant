from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import os
import json
import uuid
import datetime
import calendar
import asyncio
from app.database import (
    notifications_collection,
    notification_prefs_collection,
    users_collection,
    reminders_collection
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOTIFICATIONS_FILE = os.path.join(BASE_DIR, "app", "notifications.json")
REMINDERS_FILE = os.path.join(BASE_DIR, "app", "reminders.json")
PREFERENCES_FILE = os.path.join(BASE_DIR, "app", "notification_preferences.json")

class NotificationSchema(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    type: str # task, automation, reminder, documents_files, image_gen, background_ai, account_security, plan_billing, assistant_updates
    status: str # read, unread
    created_at: str
    priority: str = "normal" # important, normal
    related_module: Optional[str] = None

# Database helper functions
def load_notifications() -> List[dict]:
    if not os.path.exists(NOTIFICATIONS_FILE):
        return []
    try:
        with open(NOTIFICATIONS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def save_notifications(notifications: List[dict]):
    try:
        with open(NOTIFICATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(notifications, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print("Failed to save notifications:", e)

def load_preferences() -> dict:
    if not os.path.exists(PREFERENCES_FILE):
        return {}
    try:
        with open(PREFERENCES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_preferences(prefs: dict):
    try:
        with open(PREFERENCES_FILE, "w", encoding="utf-8") as f:
            json.dump(prefs, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print("Failed to save preferences:", e)

# Auth helper (matching standard main.py auth)
async def get_user(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    import jwt
    SECRET_KEY = "SUPER_SECRET_KEY_JWT_TOKEN_MEGA_ASSISTANT_123!"
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# Reusable internal creation helper
def create_notification_internal(
    user_id: str, 
    title: str, 
    message: str, 
    type: str, 
    related_module: Optional[str] = None,
    priority: str = "normal",
    idempotency_key: Optional[str] = None
) -> Optional[dict]:
    type_to_pref = {
        "reminder": "reminders",
        "task": "tasks",
        "automation": "automation",
        "documents_files": "documents_files",
        "image_gen": "image_gen",
        "background_ai": "background_ai",
        "account_security": "account_security",
        "plan_billing": "plan_billing",
        "assistant_updates": "assistant_updates"
    }
    
    pref_key = type_to_pref.get(type)
    if pref_key:
        prefs = load_preferences()
        user_prefs = prefs.get(user_id, {
            "reminders": True,
            "tasks": True,
            "automation": True,
            "documents_files": True,
            "image_gen": True,
            "background_ai": True,
            "account_security": True,
            "plan_billing": True,
            "assistant_updates": True
        })
        is_critical_security = type == "account_security" and priority == "important"
        is_plan_billing = type == "plan_billing"
        if not is_critical_security and not is_plan_billing and not user_prefs.get(pref_key, True):
            return None

    notifications = load_notifications()
    if idempotency_key:
        for n in notifications:
            if n.get("idempotency_key") == idempotency_key and n.get("user_id") == user_id:
                return n

    new_notif = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": type,
        "status": "unread",
        "priority": priority,
        "created_at": datetime.datetime.now().isoformat(),
        "related_module": related_module,
        "idempotency_key": idempotency_key
    }
    notifications.insert(0, new_notif)
    save_notifications(notifications)
    
    # Fire-and-forget MongoDB insert
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(notifications_collection.insert_one(new_notif.copy()))
    except Exception:
        pass

    return new_notif

def notify_admins_internal(title: str, message: str, related_module: Optional[str] = None, priority: str = "normal", idempotency_key: Optional[str] = None):
    try:
        USERS_FILE = os.path.join(BASE_DIR, "app", "users.json")
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                users = json.load(f)
            admin_users = [u for u in users if u.get("role") == "admin"]
            for admin in admin_users:
                admin_id = admin["id"]
                admin_idem = f"admin_{admin_id}_{idempotency_key}" if idempotency_key else None
                create_notification_internal(
                    user_id=admin_id,
                    title=title,
                    message=message,
                    type="plan_billing",
                    related_module=related_module,
                    priority=priority,
                    idempotency_key=admin_idem
                )
    except Exception as e:
        print("Failed to dispatch admin notification:", e)

def dispatch_subscription_event_notifications(
    event_type: str,
    user_id: str,
    user_email: str = "",
    user_name: str = "",
    trial_end_date: Optional[str] = None,
    access_end_date: Optional[str] = None,
    payment_id: Optional[str] = None,
    order_id: Optional[str] = None,
    amount_str: str = "₹899"
):
    now_formatted = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    user_label = user_email or user_name or user_id

    if event_type == "TRIAL_CLAIMED":
        create_notification_internal(
            user_id=user_id,
            title="Plus Trial Activated",
            message=f"Your 1-month AI Mega Assistant Plus trial is now active.\n\nPlan: Plus\nStatus: Trial Active\nTrial end date: {trial_end_date or 'N/A'}",
            type="plan_billing",
            priority="normal",
            idempotency_key=f"sub_trial_{user_id}"
        )
        notify_admins_internal(
            title="New Plus Trial Claimed",
            message=f"A user has claimed a 1-month AI Mega Assistant Plus trial.\n\nUser: {user_label}\nPlan: Plus\nDate: {now_formatted}",
            idempotency_key=f"admin_trial_{user_id}"
        )

    elif event_type == "PAID_PURCHASED":
        ref_id = payment_id or order_id or str(uuid.uuid4().hex[:8])
        create_notification_internal(
            user_id=user_id,
            title="Subscription Activated",
            message=f"Your AI Mega Assistant Plus subscription has been successfully activated.\n\nPlan: Plus\nAmount: {amount_str}/month\nStatus: Active",
            type="plan_billing",
            priority="important",
            idempotency_key=f"sub_activated_{user_id}_{ref_id}"
        )
        create_notification_internal(
            user_id=user_id,
            title="Payment Successful",
            message=f"Your payment for AI Mega Assistant Plus was successful.\n\nAmount: {amount_str}\nPlan: Plus",
            type="plan_billing",
            priority="normal",
            idempotency_key=f"pay_success_{user_id}_{ref_id}"
        )
        notify_admins_internal(
            title="New Plus Subscription",
            message=f"A user has successfully activated an AI Mega Assistant Plus subscription.\n\nUser: {user_label}\nPlan: Plus\nAmount: {amount_str}/month\nDate: {now_formatted}",
            idempotency_key=f"admin_purchased_{user_id}_{ref_id}"
        )

    elif event_type == "CANCELLED":
        end_text = access_end_date or "the end of your current billing period"
        cancel_ref = access_end_date or datetime.datetime.now().isoformat()[:10]
        create_notification_internal(
            user_id=user_id,
            title="Subscription Cancelled",
            message=f"Your AI Mega Assistant Plus subscription has been cancelled successfully.\n\nAccess remains active until: {end_text}",
            type="plan_billing",
            priority="normal",
            idempotency_key=f"sub_cancel_{user_id}_{cancel_ref}"
        )
        notify_admins_internal(
            title="Plus Subscription Cancelled",
            message=f"A user has cancelled their AI Mega Assistant Plus subscription.\n\nUser: {user_label}\nPlan: Plus\nAccess remains active until: {end_text}\nDate: {now_formatted}",
            idempotency_key=f"admin_cancel_{user_id}_{cancel_ref}"
        )

    elif event_type == "RENEWED":
        renew_ref = datetime.datetime.now().isoformat()[:10]
        create_notification_internal(
            user_id=user_id,
            title="Subscription Renewed",
            message=f"Your AI Mega Assistant Plus subscription has been renewed successfully.\n\nPlan: Plus\nAmount: {amount_str}/month\nStatus: Active",
            type="plan_billing",
            priority="normal",
            idempotency_key=f"sub_renew_{user_id}_{renew_ref}"
        )
        notify_admins_internal(
            title="Plus Subscription Renewed",
            message=f"A user has renewed their AI Mega Assistant Plus subscription.\n\nUser: {user_label}\nPlan: Plus\nAmount: {amount_str}/month\nDate: {now_formatted}",
            idempotency_key=f"admin_renew_{user_id}_{renew_ref}"
        )

    elif event_type == "PAYMENT_FAILED":
        fail_ref = order_id or datetime.datetime.now().isoformat()[:16]
        create_notification_internal(
            user_id=user_id,
            title="Payment Failed",
            message="We couldn't process your Plus subscription payment. Please update your payment method and try again.",
            type="plan_billing",
            priority="important",
            idempotency_key=f"pay_failed_{user_id}_{fail_ref}"
        )
        notify_admins_internal(
            title="Subscription Payment Failed",
            message=f"A subscription payment failed for a user.\n\nUser: {user_label}\nPlan: Plus\nDate: {now_formatted}",
            idempotency_key=f"admin_pay_failed_{user_id}_{fail_ref}"
        )

    elif event_type == "VERIFICATION_SUCCESS":
        v_ref = payment_id or order_id or str(uuid.uuid4().hex[:8])
        create_notification_internal(
            user_id=user_id,
            title="Payment Method Verified",
            message="Your payment method has been successfully verified.",
            type="plan_billing",
            priority="normal",
            idempotency_key=f"pay_v_success_{user_id}_{v_ref}"
        )

    elif event_type == "VERIFICATION_FAILED":
        vf_ref = order_id or datetime.datetime.now().isoformat()[:16]
        create_notification_internal(
            user_id=user_id,
            title="Payment Verification Failed",
            message="We couldn't verify your payment method. Please try again with a valid payment method.",
            type="plan_billing",
            priority="normal",
            idempotency_key=f"pay_v_failed_{user_id}_{vf_ref}"
        )

# REST handlers
@router.get("")
async def get_notifications(authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    user_id = user["sub"]
    
    # Query MongoDB for user notifications
    try:
        cursor = notifications_collection.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
        user_notifs = await cursor.to_list(length=None)
        if user_notifs:
            return user_notifs
    except Exception as e:
        print("[MongoDB get_notifications error]:", e)

    notifications = load_notifications()
    return [n for n in notifications if n.get("user_id") == user_id]

@router.get("/unread-count")
async def get_unread_count(authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    user_id = user["sub"]
    try:
        count = await notifications_collection.count_documents({"user_id": user_id, "status": "unread"})
        return {"unread_count": count}
    except Exception as e:
        print("[MongoDB unread-count error]:", e)
    notifications = load_notifications()
    unread_count = sum(1 for n in notifications if n.get("user_id") == user_id and n.get("status") == "unread")
    return {"unread_count": unread_count}

@router.put("/read-all")
async def mark_all_as_read(authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    user_id = user["sub"]
    try:
        await notifications_collection.update_many(
            {"user_id": user_id, "status": "unread"},
            {"$set": {"status": "read"}}
        )
    except Exception as e:
        print("[MongoDB read-all error]:", e)
    notifications = load_notifications()
    updated = False
    for n in notifications:
        if n.get("user_id") == user_id and n.get("status") == "unread":
            n["status"] = "read"
            updated = True
    if updated:
        save_notifications(notifications)
        
    return {"status": "success", "message": "All notifications marked as read"}

@router.put("/{notification_id}/read")
async def mark_as_read(notification_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    try:
        res = await notifications_collection.update_one(
            {"id": notification_id, "user_id": user["sub"]},
            {"$set": {"status": "read"}}
        )
        if res.matched_count > 0:
            return {"status": "success", "message": "Notification marked as read"}
    except Exception as e:
        print("[MongoDB mark_as_read error]:", e)

    notifications = load_notifications()
    found = False
    for n in notifications:
        if n["id"] == notification_id and n["user_id"] == user["sub"]:
            n["status"] = "read"
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Notification not found")
    save_notifications(notifications)
    return {"status": "success", "message": "Notification marked as read"}

@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    try:
        res = await notifications_collection.delete_one({"id": notification_id, "user_id": user["sub"]})
        if res.deleted_count > 0:
            return {"status": "success", "message": "Notification deleted"}
    except Exception as e:
        print("[MongoDB delete_notification error]:", e)

    notifications = load_notifications()
    filtered = [n for n in notifications if not (n["id"] == notification_id and n["user_id"] == user["sub"])]
    if len(filtered) == len(notifications):
        raise HTTPException(status_code=404, detail="Notification not found")
    save_notifications(filtered)
    return {"status": "success", "message": "Notification deleted"}

@router.get("/preferences")
async def get_preferences(authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    user_id = user["sub"]
    try:
        pref_doc = await notification_prefs_collection.find_one({"user_id": user_id}, {"_id": 0})
        if pref_doc and "preferences" in pref_doc:
            return pref_doc["preferences"]
    except Exception as e:
        print("[MongoDB get_preferences error]:", e)

    prefs = load_preferences()
    user_prefs = prefs.get(user_id, {
        "reminders": True,
        "tasks": True,
        "automation": True,
        "documents_files": True,
        "image_gen": True,
        "background_ai": True,
        "account_security": True,
        "plan_billing": True,
        "assistant_updates": True
    })
    return user_prefs

@router.put("/preferences")
async def update_preferences(data: dict, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    user_id = user["sub"]
    current = await get_preferences(authorization)
    for k, v in data.items():
        if isinstance(v, bool):
            current[k] = v
    try:
        await notification_prefs_collection.update_one(
            {"user_id": user_id},
            {"$set": {"user_id": user_id, "preferences": current}},
            upsert=True
        )
    except Exception as e:
        print("[MongoDB update_preferences error]:", e)

    prefs = load_preferences()
    prefs[user_id] = current
    save_preferences(prefs)
    return {"status": "success", "preferences": current}
