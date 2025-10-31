import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyBedlkoqSe4b9q9P-m0zTbi2Ba7NTFpyfg";
const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
  try {
    const models = await genAI.listModels();
    console.log('Available models:');
    models.forEach(model => {
      console.log(`- ${model.name}`);
    });
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

await listModels();