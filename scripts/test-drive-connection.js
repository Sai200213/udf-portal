const url = "https://script.google.com/macros/s/AKfycbwkm0P7ka8lyDesgPp9bueaqopFj2ERXYh_n7odEGtpnhPHlLRB-VFPPly6wPn8Y9LZ/exec";

async function test() {
    console.log("Testing Connection to:", url);

    // Create a valid Data URI payload (mimicking FileReader result)
    const validBase64 = "data:text/plain;base64,SGVsbG8gV29ybGQ="; // "Hello World"

    try {
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
                filename: "CONNECTIVITY_TEST_SUCCESS.txt",
                base64: validBase64,
                employeeName: "_DEBUG_TEST_",
                operationName: "Connection Check"
            }),
            headers: { "Content-Type": "text/plain" }
        });

        console.log("HTTP Status:", response.status);
        const text = await response.text();

        try {
            const json = JSON.parse(text);
            console.log("✅ JSON RECEIVED:");
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log("❌ RESPONSE IS NOT JSON:", text.substring(0, 300));
        }

    } catch (e) {
        console.error("❌ FETCH ERROR:", e);
    }
}

test();
