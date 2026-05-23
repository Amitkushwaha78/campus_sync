const express = require("express");

const router = express.Router();

const OpenAI = require("openai");

// ===========================
// GROQ CLIENT
// ===========================

const client = new OpenAI({

    apiKey: process.env.GROQ_API_KEY,

    baseURL: "https://api.groq.com/openai/v1"

});

// ===========================
// CHATBOT ROUTE
// ===========================

router.post("/chatbot", async (req, res) => {

    try {

        const userMessage = req.body.message;

        console.log("User Message:", userMessage);

        const completion =
            await client.chat.completions.create({

                model: "llama-3.1-8b-instant",

                messages: [

                    {
                        role: "system",

                        content: `
You are a college club assistant.

Help students regarding:
- notices
- events
- registrations