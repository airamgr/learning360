import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    try:
        await client.admin.command('ping')
        print("✅ Conexión a MongoDB exitosa")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")

asyncio.run(test())