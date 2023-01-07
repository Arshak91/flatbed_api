const Joi = require('joi');
const getResponse = require('../helper/index');
exports.UploadLoadboard = async (req, res, next) => {
    try {

        return next();
    } catch (error) {
        return res.send(getResponse(0, 'Something went wrong!'));
    }
};
