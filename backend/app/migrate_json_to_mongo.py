import asyncio
import json
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import (
    users_collection, chats_collection, subscriptions_collection,
    usages_collection, memories_collection, notes_collection,
    tasks_collection, reminders_collection, documents_collection,
    workflows_collection, workflow_history_collection, notifications_collection,
    notification_prefs_collection, preferences_collection, knowledge_collection,
    payments_collection, sub_config_collection, system_settings_collection,
    audit_logs_collection
)

APP_DIR = os.path.dirname(os.path.abspath(__file__))

def load_json_file(filename):
    fpath = os.path.join(APP_DIR, filename)
    if not os.path.exists(fpath):
        return None
    try:
        with open(fpath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading {filename}: {e}")
        return None

async def batch_insert_list(collection, items, key="id"):
    if not items:
        return
    existing_docs = await collection.find({}, {key: 1}).to_list(length=None)
    existing_ids = {doc[key] for doc in existing_docs if key in doc}
    
    to_insert = [item for item in items if item.get(key) and item.get(key) not in existing_ids]
    if to_insert:
        await collection.insert_many(to_insert)
        print(f"[{collection.name}] Inserted {len(to_insert)} new items.")
    else:
        print(f"[{collection.name}] All {len(items)} items already present.")

async def migrate_data():
    print("==================================================")
    print(" BATCH JSON TO MONGODB MIGRATION RUNNING         ")
    print("==================================================")

    # 1. Users Migration
    users_data = load_json_file("users.json")
    if users_data:
        await batch_insert_list(users_collection, users_data, "id")

    # 2. Chats Migration
    chats_data = load_json_file("chats.json")
    if chats_data:
        await batch_insert_list(chats_collection, chats_data, "id")

    # 3. Subscriptions Migration
    subs_data = load_json_file("subscriptions.json")
    if subs_data:
        await batch_insert_list(subscriptions_collection, subs_data, "id")

    # 4. Memories Migration
    mems_data = load_json_file("memories.json")
    if mems_data:
        await batch_insert_list(memories_collection, mems_data, "id")

    # 5. Notes Migration
    notes_data = load_json_file("notes.json")
    if notes_data:
        await batch_insert_list(notes_collection, notes_data, "id")

    # 6. Tasks Migration
    tasks_data = load_json_file("tasks.json")
    if tasks_data:
        await batch_insert_list(tasks_collection, tasks_data, "id")

    # 7. Reminders Migration
    reminders_data = load_json_file("reminders.json")
    if reminders_data:
        await batch_insert_list(reminders_collection, reminders_data, "id")

    # 8. Documents Migration
    docs_data = load_json_file("documents.json")
    if docs_data:
        await batch_insert_list(documents_collection, docs_data, "id")

    # 9. Workflows Migration
    workflows_data = load_json_file("workflows.json")
    if workflows_data:
        await batch_insert_list(workflows_collection, workflows_data, "id")

    # 10. Workflow History Migration
    wf_history_data = load_json_file("workflow_history.json")
    if wf_history_data:
        await batch_insert_list(workflow_history_collection, wf_history_data, "id")

    # 11. Notifications Migration
    notifs_data = load_json_file("notifications.json")
    if notifs_data:
        await batch_insert_list(notifications_collection, notifs_data, "id")

    # 12. Notification Preferences Migration
    notif_prefs_data = load_json_file("notification_preferences.json")
    if notif_prefs_data and isinstance(notif_prefs_data, dict):
        for uid, prefs in notif_prefs_data.items():
            doc = {"user_id": uid, "preferences": prefs}
            await notification_prefs_collection.update_one(
                {"user_id": uid},
                {"$set": doc},
                upsert=True
            )
        print(f"[notification_preferences] Migrated preferences for {len(notif_prefs_data)} users.")

    # 13. User Preferences Migration
    prefs_data = load_json_file("preferences.json")
    if prefs_data and isinstance(prefs_data, dict):
        for uid, prefs in prefs_data.items():
            doc = {"user_id": uid, "preferences": prefs}
            await preferences_collection.update_one(
                {"user_id": uid},
                {"$set": doc},
                upsert=True
            )
        print(f"[preferences] Migrated preferences for {len(prefs_data)} users.")

    # 14. Knowledge Base Migration
    kb_data = load_json_file("knowledge_base.json")
    if kb_data:
        await batch_insert_list(knowledge_collection, kb_data, "id")

    # 15. Payments Migration
    pmt_data = load_json_file("payments.json")
    if pmt_data:
        await batch_insert_list(payments_collection, pmt_data, "id")

    # 16. Subscription Config Migration
    sub_cfg_data = load_json_file("subscription_config.json")
    if sub_cfg_data and isinstance(sub_cfg_data, dict):
        sub_cfg_data["config_key"] = "primary_config"
        await sub_config_collection.update_one(
            {"config_key": "primary_config"},
            {"$set": sub_cfg_data},
            upsert=True
        )
        print(f"[subscription_config] Migrated subscription configuration.")

    # 17. System Settings Migration
    sys_settings_data = load_json_file("system_settings.json")
    if sys_settings_data and isinstance(sys_settings_data, dict):
        sys_settings_data["settings_key"] = "primary_settings"
        await system_settings_collection.update_one(
            {"settings_key": "primary_settings"},
            {"$set": sys_settings_data},
            upsert=True
        )
        print(f"[system_settings] Migrated system settings.")

    # 18. Audit Logs Migration
    audit_data = load_json_file("audit_logs.json")
    if audit_data:
        await batch_insert_list(audit_logs_collection, audit_data, "id")

    print("\n==================================================")
    print(" BATCH MIGRATION TO MONGODB COMPLETE!            ")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(migrate_data())
