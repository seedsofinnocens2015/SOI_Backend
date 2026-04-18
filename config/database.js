const mongoose = require('mongoose');

const connectDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required to start the SEO backend');
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log('MongoDB connected');
};

module.exports = {
  connectDatabase,
};
