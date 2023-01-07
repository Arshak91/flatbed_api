const Cities = require('../mongoModels/CitiesModel');
const getResponse = require('../helper');

exports.search = async (req, res) => {
    const filter = {};
    if (!!req.query.country) {
        filter['iso2'] = req.query.country.toUpperCase();
    } else {
        filter['$or'] = [
            { 'iso2': 'US' },
            { 'iso2': 'MX' },
            { 'iso2': 'CA' }
        ];
    }
    if (!!req.query.state) {
        filter['admin_name'] = req.query.state;
    }
    if (!!req.query.search) {
        const key = req.query.search.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '').trim();
        filter.city = new RegExp(key, 'i');
    }
    const list = await Cities.find(filter).limit(20);
    const response = [];
    await Promise.all(list.map(async item => {
        response.push({
            id: item._id,
            name: item.city,
            country: item.country,
            state: item.admin_name,
            lat: item.lat,
            lng: item.lng,
        });
    }));
    return res.send(getResponse(1, 'Cities list', response ));
};

exports.detail = async (req, res) => {
    const city = await Cities.findById(req.query.id);
    if (!city) return res.send(getResponse(0, 'city not found'))

    return res.send(getResponse(1, 'City detail', city));
}

exports.getStateList = async (req, res) => {
    const filter = {};
    if (!!req.query.country) {
        filter.iso2 = req.query.country.toUpperCase();
    } else {
        filter['$or'] = [
            { 'iso2': 'US' },
            { 'iso2': 'MX' },
            { 'iso2': 'CA' }
        ];
    }
    if (!!req.query.search) {
        const key = req.query.search.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '').trim();

        filter.admin_name = new RegExp(key, 'i');
    }

    const list = await Cities.find(filter).limit(20);
    const response = [];
    await Promise.all(list.map(async item => {
        const index = response.findIndex(x => x.country === item.country);
        if (index < 0) {
            response.push({
                name: !!item.shortState ? `${item.admin_name}, ${item.shortState}` : item.admin_name,
                country: item.country
            });
        }
    }));
    console.log(response);
    return res.send(getResponse(1, 'State list', response));

}