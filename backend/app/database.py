from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = AsyncIOMotorClient(settings.MONGODB_URI)

database = client["mega_ai_assistant"]

# Core Collections
users_collection = database["users"]
chats_collection = database["chats"]
subscriptions_collection = database["subscriptions"]
usages_collection = database["usages"]
memories_collection = database["memories"]

# Productivity Collections
notes_collection = database["notes"]
tasks_collection = database["tasks"]
reminders_collection = database["reminders"]
documents_collection = database["documents"]
workflows_collection = database["workflows"]
workflow_history_collection = database["workflow_history"]

# Communication & Preference Collections
notifications_collection = database["notifications"]
notification_prefs_collection = database["notification_preferences"]
preferences_collection = database["preferences"]
knowledge_collection = database["knowledge_base"]

# Billing & Admin Collections
payments_collection = database["payments"]
sub_config_collection = database["subscription_config"]
system_settings_collection = database["system_settings"]
audit_logs_collection = database["audit_logs"]