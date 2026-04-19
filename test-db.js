const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const uri = process.env.MONGO_URI;

mongoose.connect(uri)
  .then(() => {
    console.log("SUCCESSFUL CONNECTION TO DB!");
    process.exit(0);
  })
  .catch(err => {
    console.error("CONNECTION ERROR DETAILS:");
    console.error(err);
    process.exit(1);
  });
