const UploadClass = require('../mongoClasses/upload');

exports.getOne = async (req, res) => {
    let { id } = req.params, uploadCl, result;
    uploadCl = new UploadClass({id});
    result = await uploadCl.getOne();
    res.json(result);
};