const Joi = require('joi');
const getResponse = require('../helper/index');
const Settings = require('../mongoModels/SettingsModel');
exports.CreateFilter = async (req, res, next) => {
    try {
        let filter = {};
        filter['userId'] = req.user._id;
        console.log(req.user._id);
        if (req.body.loadsFilters) {
            filter['$or'] = [
                { 'listFilters.loadsFilters.name': req.body.loadsFilters.name },
                { 'listFilters.loadsFilters.filter': req.body.loadsFilters.filter }
            ];
        }

        if (req.body.capacityFilters) {
            filter['$or'] = [
                { 'listFilters.capacityFilters.name': req.body.capacityFilters.name },
                { 'listFilters.capacityFilters.filter': req.body.capacityFilters.filter }
            ];
        }

        if (req.body.matchingFilters) {
            filter['$or'] = [
                { 'listFilters.matchingFilters.name': req.body.matchingFilters.name },
                { 'listFilters.matchingFilters.filter': req.body.matchingFilters.filter }
            ];
        }

        const list = await Settings.find(filter);

        if (list.length) return res.send(getResponse(0, 'Such a filter exists.'));

        return next();
    } catch (error) {
        return res.send(getResponse(0, 'Something went wrong!'));
    }
};
