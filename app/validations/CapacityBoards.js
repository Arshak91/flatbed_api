const Joi = require('joi');
const getResponse = require('../helper/index');
const LoadBoard = require('../mongoModels/LoadBoardModel');
const CapacityBoard = require('../mongoModels/CapacityBoardModel');

exports.SendRequest = async (req, res, next) => {
    try {
        const schema = Joi.object({
            loadIds: Joi.array().required(),
            capacityId: Joi.string().required(),
            type: Joi.number().min(1).max(2).required()
        });
        const result = schema.validate(req.body);
        if (result.error) return res.send(getResponse(0, result.error.message));

        if (!req.user || !req.user.email) return res.send(getResponse(0, 'User not have an email'));
        
        const capacity = await CapacityBoard.findById(req.body.capacityId);
        if (!capacity) return res.send(getResponse(0, 'Wrong CapacityBoard id'));

        if (!!!req.body.loadIds.length) return res.send(getResponse(0, 'Loads list can not be empty'));

        const loads = await LoadBoard.find({ _id: { $in: req.body.loadIds } });
        
        
        if (!loads.length) return res.send(getResponse(0, 'Wrong Loadboard id'));


        req.body.loads = loads;
        req.body.capacity = capacity;
        return next();
    } catch (error) {
        return res.send(getResponse(0, 'Something went wrong!'));
    }
};
