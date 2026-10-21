
import os

from dotenv import load_dotenv
from groq import Groq

# Load the API key.
load_dotenv()

# Create the Groq client.
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Request models available to your account.
models = client.models.list()

print("\n=== AVAILABLE GROQ MODELS ===")

for model in models.data:
    print(model.id)
