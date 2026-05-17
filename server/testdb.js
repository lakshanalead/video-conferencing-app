require("dotenv").config();
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI)
  .then(function() {
    console.log("✅ MongoDB Atlas connected successfully");
    process.exit(0);
  })
  .catch(function(err) {
    console.log("❌ Connection failed:", err.message);
    process.exit(1);
  });