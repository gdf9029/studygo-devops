const path = require("path");
const mongoose = require("mongoose");

// Ensure environment variables are loaded when running the script directly
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const database = require("../config/database");
const Category = require("../models/Category");

const DEFAULT_CATEGORIES = [
  { name: "Web Development", description: "Frontend and backend tracks" },
  { name: "Data Science", description: "ML, analytics, and visualization" },
  { name: "Mobile Development", description: "Android and iOS stacks" }
];

async function seedCategories() {
  try {
    database.connect();

    await new Promise((resolve, reject) => {
      mongoose.connection.once("open", resolve);
      mongoose.connection.once("error", reject);
    });

    for (const category of DEFAULT_CATEGORIES) {
      await Category.updateOne(
        { name: category.name },
        { $setOnInsert: category },
        { upsert: true }
      );
    }

    console.log("Category seed completed");
  } catch (error) {
    console.error("Failed seeding categories", error);
  } finally {
    await mongoose.connection.close();
  }
}

seedCategories();
