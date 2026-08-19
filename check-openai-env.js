import OpenAI from "openai";

const apiKey =
    process.env.SCHEDULING_OPENAI_API_KEY;

console.log(
    "SCHEDULING key exists:",
    Boolean(apiKey)
);

console.log(
    "SCHEDULING key length:",
    apiKey?.length
);

console.log(
    "SCHEDULING key starts with sk:",
    apiKey?.startsWith("sk-")
);

const client = new OpenAI({
    apiKey,
    baseURL: "https://api.openai.com/v1",
});

try {
    const response =
        await client.responses.create({
            model: "gpt-5.2",
            input: "ענה רק במילה שלום",
        });

    console.log("SUCCESS:");
    console.log(response.output_text);
} catch (error) {
    console.log("OPENAI ERROR:");
    console.log("status:", error.status);
    console.log("code:", error.code);
    console.log("message:", error.message);

    if (error?.error) {
        console.log(
            "details:",
            JSON.stringify(
                error.error,
                null,
                2
            )
        );
    }
}