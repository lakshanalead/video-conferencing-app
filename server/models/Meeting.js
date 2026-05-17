const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema({
  meetingId: { type: String, required: true, unique: true },
  title:     { type: String, default: "My Meeting" },
  hostId:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  isActive:  { type: Boolean, default: true },
});

module.exports = mongoose.model("Meeting", meetingSchema);