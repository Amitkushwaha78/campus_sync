const toggleBtn =
    document.getElementById("aiToggleBtn");

const chatWindow =
    document.getElementById("aiChatWindow");

const closeBtn =
    document.getElementById("closeAi");

const sendBtn =
    document.getElementById("aiSendBtn");

const input =
    document.getElementById("aiInput");

const messages =
    document.getElementById("aiMessages");

// OPEN CHAT

toggleBtn.onclick = () => {

    chatWindow.style.display = "flex";

};

// CLOSE CHAT

closeBtn.onclick = () => {

    chatWindow.style.display = "none";

};

// SEND MESSAGE

sendBtn.onclick = sendMessage;
input.addEventListener('keypress', function(event) {

    if (event.key === 'Enter') {

        sendMessage();

    }

});

async function sendMessage() {

    const text = input.value.trim();

    if (!text) return;

    messages.innerHTML += `
        <div class="ai-user">
            ${text}
        </div>
    `;

    input.value = "";

    try {

        const response =
            await fetch(
                "http://localhost:4600/api/chatbot",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        message: text
                    })
                }
            );

        const data =
            await response.json();

        messages.innerHTML += `
            <div class="ai-bot">
                ${data.reply}
            </div>
        `;

        messages.scrollTop =
            messages.scrollHeight;

    } catch (error) {

        messages.innerHTML += `
            <div class="ai-bot">
                Server Error
            </div>
        `;

    }

}