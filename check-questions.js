// check-questions.js
const mongoose = require("mongoose");
require("dotenv").config();

const QuestionSchema = new mongoose.Schema(
  {
    questionText: String,
    options: [String],
    correctAnswer: [Number],
    year: Number,
    qcmYear: Number,
    speciality: String,
    university: String,
    unite: { type: mongoose.Schema.Types.ObjectId, ref: "Unite" },
    module: { type: mongoose.Schema.Types.ObjectId, ref: "Module" },
    cours: { type: mongoose.Schema.Types.ObjectId, ref: "Cours" }
  },
  { timestamps: true }
);

const Question = mongoose.model("Question", QuestionSchema);

(async () => {
  try {
    console.log("🔗 Connexion à MongoDB…");
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ Connecté !");
    console.log("📂 Database utilisée :", conn.connection.db.databaseName);

    // Nom réel de la collection
    console.log("📁 Collection Question ->", Question.collection.name);

    const count = await Question.countDocuments();
    console.log("📊 Nombre total de documents dans cette collection :", count);

    const one = await Question.findOne().lean();
    console.log("🧪 Exemple de document :");
    console.dir(one, { depth: null });

    process.exit(0);
  } catch (e) {
    console.error("❌ Erreur :", e);
    process.exit(1);
  }
})();