import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyBedlkoqSe4b9q9P-m0zTbi2Ba7NTFpyfg";

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function main() {
  const result = await model.generateContent("How does AI work?");
  const response = await result.response;
  console.log(response.text());
}

await main();