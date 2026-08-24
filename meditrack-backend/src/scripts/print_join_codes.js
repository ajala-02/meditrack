require('dotenv').config();
const mongoose = require('mongoose');

const Patient = require('../models/Patient');
const User = require('../models/User');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const patients = await Patient.find({}).populate('userId', 'email').lean();

    console.log('\nPatient join codes:');
    patients.forEach((p) => {
      const email = p.userId && p.userId.email ? p.userId.email : '<no-email>';
      console.log(`  ${email} — joinCode: ${p.joinCode || 'N/A'}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error fetching join codes:', err);
    process.exit(1);
  }
};

run();
