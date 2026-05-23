async function sendMessage() {

    const input = document.getElementById("userInput");
    const chatBox = document.getElementById("chatBox");

    const message = input.value;

    // Prevent empty message
    if (message.trim() === "") return;

    // Show user message
    chatBox.innerHTML += `
        <div style="margin-bottom:10px;">
            <b>You:</b> ${message}
        </div>
    `;

    // Clear input
    input.value = "";

    try {

        // Send message to backend
        const response = await fetch('/api/chatbot', {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                message: message
            })

        });

        // Convert response to JSON
        const data = await response.json();

        // Show bot reply
        chatBox.innerHTML += `
            <div style="margin-bottom:15px;">
                <b>Bot:</b> ${data.reply}
            </div>
        `;

        // Auto scroll
        chatBox.scrollTop = chatBox.scrollHeight;

    } catch (error) {

        console.log("Chatbot Error:", error);

        chatBox.innerHTML += `
            <div style="color:red;">
                <b>Bot:</b> Error connecting to AI
            </div>
        `;
    }
}