const mongoose = require('mongoose');
const mongoDB = require('../config/mongo_common.config');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    id: { type: String, default: null },
    type: { type: String, default: null },
    username: { type: String, default: null },
    email: { type: String, default: null },
    password: { type: String, default: null },
    name: { type: String, default: null },
    company: { type: String, default: null },
    Phone: { type: String, default: null },
    businessType: { type: String, default: null, required: false },
    usDotNumber: { type: String, default: null, required: false },
    mcNumber: { type: String, default: null },
    isActive: { type: Number, default: 0 },
    changePasswordAt: { type: Date, default: null },
    logoutAt: { type: Date, default: null },
    createdAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null }
},
{
    collection: 'Users'
}
);

module.exports = User = mongoDB.model("Users", userSchema);
