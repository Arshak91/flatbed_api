const Cities = require('../mongoModels/CitiesModel');
exports.getCapFilterObject = async (query, userId) => {
    const filter = {};
    filter['deleted'] = { $ne: true };
    if (userId) { // && userId > 0){ // for carrier - only his loads
        filter['publishedBy.userId'] = userId; //  parseInt(userId)
    }

    if (query.ids) {
        if (Array.isArray(query.ids)) {
            filter['_id'] = { $in: query.ids };
        } else {
            filter['_id'] = { $in: query.ids.split(',') };
        }
    }

    if (query.pickupLocationType) {
        filter['order.start.locationType'] = query.pickupLocationType;
    }
    if (query.deliveryLocationType) {
        filter['order.end.locationType'] = query.deliveryLocationType;
    }
    if (query.pickupAccessorials) {
        filter['order.start.accessorial'] = query.pickupAccessorials;
    }
    if (query.deliveryAccessorials) {
        filter['order.end.accessorial'] = query.deliveryAccessorials;
    }
    if (query.startCity) {
        filter['order.start.city'] = query.startCity;
    }
    if (query.endCity) {
        filter['order.start.city'] = query.endCity;
    }

    if (query.startCityId && query.startStateRange) {
        const city = await Cities.findById(query.startCityId);
        if (!city) return false;

        const citiesRange =  await getCitiesFromRange(city.lat, city.lng, +query.startStateRange);

        const idList = citiesRange.map(item => item._id);
        const nemeList = [];

        await Promise.all(citiesRange.map(item => {
            const key = item.name.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '').trim();
            nemeList.push(new RegExp(key, 'i'));
        }));

        if (citiesRange.length) {
            filter['$or'] = [
                { 'order.start.cityId': { $in: idList } },
                { 'order.start.city': { $in: nemeList } },
            ];
        } else {
            filter['order.start.city'] = new RegExp(`^.*${query.start_city.trim()}.*$`, 'i');
        }
    }
    if (query.start_city && !query.startStateRange) {
        filter['order.start.city'] = new RegExp(`^.*${query.start_city.trim()}.*$`, 'i');
    }
    // if (query.start_city) {
    //     filter['order.start.city'] = new RegExp(`^.*${query.start_city}.*$`, 'i')
    // }


    if (query.endCityId && query.endStateRange) {
        const city = await Cities.findById(query.endCityId);
        if (!city) return false;

        const citiesRange =  await getCitiesFromRange(city.lat, city.lng, +query.endStateRange);

        const idList = citiesRange.map(item => item._id);
        const nemeList = [];

        await Promise.all(citiesRange.map(item => {
            const key = item.name.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '').trim();
            nemeList.push(new RegExp(key, 'i'));
        }));

        if (citiesRange.length) {
            filter['$or'] = [
                { 'order.end.cityId': { $in: idList } },
                { 'order.end.city': { $in: nemeList } },
            ];
        } else {
            filter['order.end.city'] = new RegExp(`^.*${query.start_city.trim()}.*$`, 'i');
        }
    }
    if (query.end_city && !query.endStateRange) {
        filter['order.end.city'] = new RegExp(`^.*${query.end_city.trim()}.*$`, 'i');
    }


    // if(query.equipment_type){
    //     filter['order.equipment.eqType'] = parseInt(query.equipment_type)
    // }
    if (query.equipment_ids) {
        // filter['order.equipment._id'] = new mongo.ObjectID(query.equipment_id)
        let eqId = query.equipment_ids.split(',');
        filter['order.equipment._id'] = { $in: eqId };
    }

    // start - end
    if (query.start_country && query.start_country.trim() != '') {
        filter['order.start.country'] = new RegExp(`^.*${query.start_country.trim()}.*$`, 'i')
    }
    if (query.start_state) {
        const sl1 = new RegExp(`^.*${query.start_state.slice(0, query.start_state.indexOf(','))}.*$`, 'i');
        const sl2 = new RegExp(`^.*${query.start_state.slice(query.start_state.indexOf(',') + 1, query.start_state.length).trim()}.*$`, 'i');
        filter['$or'] = [
            { 'order.start.state': sl1 },
            { 'order.start.state': sl2 },
        ];
        // filter['$and'] = [ 
        //     { '$or': [ { 'order.start.state': sl }, { 'order.start.stateLong': { $exists: true, $regex: sl } } ] } 
        // ];
    }

    if (query.start_zip) {
        filter['order.start.zip'] = new RegExp(`^.*${query.start_zip}.*$`, 'i')
    }
    // if (query.name) {
    //     filter['name'] = new RegExp(`^.*${query.name}.*$`, 'i'); 
    // }
    if (query.name) {
        filter['$or'] = [
            { 'order.name': new RegExp(`^.*${query.name.trim()}.*$`, 'i') },
            { 'name': new RegExp(`^.*${query.name.trim()}.*$`, 'i') }
        ];
    }
    if (query.pickupDateFrom) {
        filter['order.start.timeWindowFrom'] = { $gte: query.pickupDateFrom };
    }
    if (query.pickupDateTo) {
        filter['order.start.timeWindowTo'] = { $lte: query.pickupDateTo };
    }

    if (query.deliveryDateFrom) {
        filter['order.end.timeWindowFrom'] = { $gte: query.deliveryDateFrom };
    }
    if (query.deliveryDateTo) {
        filter['order.end.timeWindowTo'] = { $lte: query.deliveryDateTo };
    }

    if (query.end_anywhere && query.end_anywhere == 'true') {
        delete filter['order.end.timeWindowFrom'];
        delete filter['order.end.timeWindowTo'];
        filter['order.end'] = null;
    } else {
        if (query.end_country && query.end_country.trim() != '') {
            filter['order.end.country'] = new RegExp(`^.*${query.end_country.trim()}.*$`, 'i')
        }
        if (query.end_state) {
            // filter['order.end.state'] = new RegExp(`^.*${query.end_state}.*$`, 'i')

            const sl1 = new RegExp(`^.*${query.end_state.slice(0, query.end_state.indexOf(','))}.*$`, 'i');
            const sl2 = new RegExp(`^.*${query.end_state.slice(query.end_state.indexOf(',') + 1, query.end_state.length).trim()}.*$`, 'i');
            filter['$or'] = [
                { 'order.end.state': sl1 },
                { 'order.end.state': sl2 },
            ];

            // if(filter['$and']){
            //     filter['$and'].push({
            //         '$or': [ { 'order.end.state': sl }, { 'order.end.stateLong': { $exists: true, $regex: sl } } ] 
            //     })
            // }else{
            //     filter['$and'] = [ 
            //         { '$or': [ { 'order.end.state': sl }, { 'order.end.stateLong': { $exists: true, $regex: sl } } ] } 
            //     ];
            // }
        }
        if (query.end_zip) {
            filter['order.end.zip'] = new RegExp(`^.*${query.end_zip}.*$`, 'i')
        }
    }

    // flat rate
    if (query.flatRateMin && !query.flatRateMax && query.flatRateMin.trim() != '') {
        filter['order.flatRate'] = { $gte: Number(query.flatRateMin) };
    } else if (!query.flatRateMin && query.flatRateMax && query.flatRateMax.trim() != '') {
        filter['order.flatRate'] = { $lte: Number(query.flatRateMax), $gt: 0 };
    } else if (query.flatRateMin && query.flatRateMax && query.flatRateMin.trim() != '' && query.flatRateMax.trim() != '') {
        filter['order.flatRate'] = { $gte: Number(query.flatRateMin), $lte: Number(query.flatRateMax) };
    }
    // per mile rate
    if (query.perMileRateMin && !query.perMileRateMax && query.perMileRateMin.trim() != '') {
        filter['order.perMileRate'] = { $gte: Number(query.perMileRateMin) };
    } else if (!query.perMileRateMin && query.perMileRateMax && query.perMileRateMax.trim() != '') {
        filter['order.perMileRate'] = { $lte: Number(query.perMileRateMax), $gt: 0 };
    } else if (query.perMileRateMin && query.perMileRateMax && query.perMileRateMin.trim() != '' && query.perMileRateMax.trim() != '') {
        filter['order.perMileRate'] = { $gte: Number(query.perMileRateMin), $lte: Number(query.perMileRateMax) };
    }
    // distance
    if (query.mileMin && !query.mileMax && query.mileMin.trim() != '') {
        filter['order.distance'] = { $gte: Number(query.mileMin * 1609) };
    } else if (!query.mileMin && query.mileMax && query.mileMax.trim() != '') {
        filter['order.distance'] = { $lte: Number(query.mileMax * 1609), $gt: 0 };
    } else if (query.mileMin && query.mileMax && query.mileMin.trim() != '' && query.mileMax.trim() != '') {
        filter['order.distance'] = { $gte: Number(query.mileMin * 1609), $lte: Number(query.mileMax * 1609) };
    }

    // company
    if (query.company && query.company.trim() != '') {
        const c = new RegExp(`^.*${query.company}.*$`, 'i');
        if (userId) {
            filter['$or'] = [
                { 'order.start.company': c },
                { 'order.end.company': c }
            ];
        } else {
            filter['$or'] = [
                { 'publishedBy.company': c },
                { 'publishedBy.email': c },
                { 'publishedBy.name': c },
                { 'publishedBy.username': c }
            ];
        }
    }

    // size - weight
    if (query.sizeType) {
        if (query.sizeMin && !query.sizeMax) {
            filter[`order.${query.sizeType}`] = { $gte: Number(query.sizeMin) };
        }
        else if (!query.sizeMin && query.sizeMax) {
            filter[`order.${query.sizeType}`] = { $lte: Number(query.sizeMax), $gt: 0 };
        }
        else if (query.sizeMin && query.sizeMax) {
            filter[`order.${query.sizeType}`] = { $gte: Number(query.sizeMin), $lte: Number(query.sizeMax) };
        }
    }
    return filter;
};

exports.getLoadFilterObject = async (query, userId) => {
    const filter = {};
    filter['deleted'] = { $ne: true };
    if (userId) { // && userId > 0){ // for broker - only his loads
        filter['publishedBy.userId'] = userId; // parseInt(userId)
    } else { // for carrier - only public loads
        filter['type'] = 0; // public
    }

    if (query.ids) {
        if (Array.isArray(query.ids)) {
            filter['_id'] = { $in: query.ids };
        } else {
            filter['_id'] = { $in: query.ids.split(',') };
        }
    }

    // if (query.start_city) {
    //     filter['order.start.city'] = new RegExp(`^.*${query.start_city.trim()}.*$`, 'i');
    // }
    // if (query.end_city) {
    //     filter['order.end.city'] = new RegExp(`^.*${query.end_city.trim()}.*$`, 'i');
    // }
    // if(query.equipment_type){
    //     filter['order.equipment.eqType'] = parseInt(query.equipment_type)
    // }
    if (query.pickupLocationType) {
        filter['order.start.locationType'] = query.pickupLocationType;
    }
    if (query.deliveryLocationType) {
        filter['order.end.locationType'] = query.deliveryLocationType;
    }
    if (query.locationType) {
        filter['locationType'] = query.locationType;
    }
    if (query.pickupAccessorials) {
        filter['order.start.accessorial'] = query.pickupAccessorials;
    }
    if (query.deliveryAccessorials) {
        filter['order.end.accessorial'] = query.deliveryAccessorials;
    }
    if (query.equipment_ids) {
        // filter['order.equipment._id'] = new mongo.ObjectID(query.equipment_id)
        let eqId = query.equipment_ids.split(',');
        filter['order.equipment._id'] = { $in: eqId };
    }

    if (query.endCityId && query.endStateRange) {
        const city = await Cities.findById(query.endCityId);
        if (!city) return false;

        const citiesRange =  await getCitiesFromRange(city.lat, city.lng, +query.endStateRange);

        const idList = citiesRange.map(item => item._id);
        const nemeList = [];

        await Promise.all(citiesRange.map(item => {
            const key = item.name.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '').trim();
            nemeList.push(new RegExp(key, 'i'));
        }));

        if (citiesRange.length) {
            filter['$or'] = [
                { 'order.end.cityId': { $in: idList } },
                { 'order.end.city': { $in: nemeList } },
            ];
        }  else {
            filter['order.end.city'] = new RegExp(`^.*${query.start_city.trim()}.*$`, 'i');
        }
    }
    if (query.end_city && !query.endStateRange) {
        filter['order.end.city'] = new RegExp(`^.*${query.end_city.trim()}.*$`, 'i');
    }

    if (query.startCityId && query.startStateRange) {
        const city = await Cities.findById(query.startCityId);
        if (!city) return false;

        const citiesRange =  await getCitiesFromRange(city.lat, city.lng, +query.startStateRange);

        const idList = citiesRange.map(item => item._id);
        const nemeList = [];

        await Promise.all(citiesRange.map(item => {
            const key = item.name.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '').trim();
            nemeList.push(new RegExp(key, 'i'));
        }));

        if (citiesRange.length) {
            filter['$or'] = [
                { 'order.start.cityId': { $in: idList } },
                { 'order.start.city': { $in: nemeList } },
            ];
        } else {
            filter['order.start.city'] = new RegExp(`^.*${query.start_city.trim()}.*$`, 'i');
        }
    }
    if (query.start_city && !query.startStateRange) {
        filter['order.start.city'] = new RegExp(`^.*${query.start_city.trim()}.*$`, 'i');
    }

    if (query.start_country && query.start_country.trim() != '') {
        filter['order.start.country'] = new RegExp(`^.*${query.start_country.trim()}.*$`, 'i');
    }
    if (query.name) {
        filter['$or'] = [
            { 'order.name': new RegExp(`^.*${query.name.trim()}.*$`, 'i') },
            { 'name': new RegExp(`^.*${query.name.trim()}.*$`, 'i') }
        ];
    }
    if (query.start_state) {
        const sl1 = new RegExp(`^.*${query.start_state.slice(0, query.start_state.indexOf(','))}.*$`, 'i');
        const sl2 = new RegExp(`^.*${query.start_state.slice(query.start_state.indexOf(',') + 1, query.start_state.length).trim()}.*$`, 'i');
        filter['$or'] = [
            { 'order.start.state': sl1 },
            { 'order.start.state': sl2 },
        ];
    }
    if (query.start_city) {
        // filter['order.start.city'] = new RegExp(`.*${query.start_city}.*`)
        filter['order.start.city'] = new RegExp(`^.*${query.start_city}.*$`, 'i');
    }
    if (query.start_zip) {
        // filter['order.start.zip'] = query.start_zip
        filter['order.start.zip'] = new RegExp(`^.*${query.start_zip}.*$`, 'i');
    }

    if (query.pickupDateFrom) {
        filter['order.start.timeWindowFrom'] = { $gte: query.pickupDateFrom };
    }
    if (query.pickupDateTo) {
        filter['order.start.timeWindowTo'] = { $lte: query.pickupDateTo };
    }

    if (query.deliveryDateFrom) {
        filter['order.end.timeWindowFrom'] = { $gte: query.deliveryDateFrom };
    }
    if (query.deliveryDateTo) {
        filter['order.end.timeWindowTo'] = { $lte: query.deliveryDateTo };
    }

    if (query.end_country && query.end_country.trim() != '') {
        filter['order.end.country'] = new RegExp(`^.*${query.end_country.trim()}.*$`, 'i');
    }
    if (query.loadType) {
        filter['loadType'] = query.loadType;
    }
    if (query.end_state) {
        const sl1 = new RegExp(`^.*${query.end_state.slice(0, query.end_state.indexOf(','))}.*$`, 'i');
        const sl2 = new RegExp(`^.*${query.end_state.slice(query.end_state.indexOf(',') + 1, query.end_state.length).trim()}.*$`, 'i');
        filter['$or'] = [
            { 'order.end.state': sl1 },
            { 'order.end.state': sl2 },
        ];
    }
    if (query.end_city) {
        // filter['order.end.city'] = query.end_city
        filter['order.end.city'] = new RegExp(`^.*${query.end_city}.*$`, 'i');
    }
    if (query.end_zip) {
        // filter['order.end.zip'] = query.end_zip
        filter['order.end.zip'] = new RegExp(`^.*${query.end_zip}.*$`, 'i');
    }

    // flat rate
    if (query.flatRateMin && !query.flatRateMax && query.flatRateMin.trim() != '') {
        filter['order.flatRate'] = { $gte: Number(query.flatRateMin) };
    } else if (!query.flatRateMin && query.flatRateMax && query.flatRateMax.trim() != '') {
        filter['order.flatRate'] = { $lte: Number(query.flatRateMax), $gt: 0 };
    } else if (query.flatRateMin && query.flatRateMax && query.flatRateMin.trim() != '' && query.flatRateMax.trim() != '') {
        filter['order.flatRate'] = { $gte: Number(query.flatRateMin), $lte: Number(query.flatRateMax) };
    }
    // per mile rate
    if (query.perMileRateMin && !query.perMileRateMax && query.perMileRateMin.trim() != '') {
        filter['order.perMileRate'] = { $gte: Number(query.perMileRateMin) };
    } else if (!query.perMileRateMin && query.perMileRateMax && query.perMileRateMax.trim() != '') {
        filter['order.perMileRate'] = { $lte: Number(query.perMileRateMax), $gt: 0 };
    } else if (query.perMileRateMin && query.perMileRateMax && query.perMileRateMin.trim() != '' && query.perMileRateMax.trim() != '') {
        filter['order.perMileRate'] = { $gte: Number(query.perMileRateMin), $lte: Number(query.perMileRateMax) };
    }
    // distance
    if (query.mileMin && !query.mileMax && query.mileMin.trim() != '') {
        filter['order.distance'] = { $gte: Number(query.mileMin * 1609) };
    } else if (!query.mileMin && query.mileMax && query.mileMax.trim() != '') {
        filter['order.distance'] = { $lte: Number(query.mileMax * 1609), $gt: 0 };
    } else if (query.mileMin && query.mileMax && query.mileMin.trim() != '' && query.mileMax.trim() != '') {
        filter['order.distance'] = { $gte: Number(query.mileMin * 1609), $lte: Number(query.mileMax * 1609) };
    } // 727161.9
    // company
    if (query.company && query.company.trim() != '') {
        const c = new RegExp(`^.*${query.company}.*$`, 'i');
        if (userId) {
            filter['$or'] = [
                { 'order.start.company': c },
                { 'order.end.company': c }
            ];
        } else {
            filter['$or'] = [
                { 'publishedBy.company': c },
                { 'publishedBy.email': c },
                { 'publishedBy.name': c },
                { 'publishedBy.username': c }
            ];
        }

    }


    if (query.sizeType) {
        if (query.sizeMin && !query.sizeMax) {
            filter[`order.${query.sizeType}`] = { $gte: Number(query.sizeMin) };
        }
        else if (!query.sizeMin && query.sizeMax) {
            filter[`order.${query.sizeType}`] = { $lte: Number(query.sizeMax), $gt: 0 };
        }
        else if (query.sizeMin && query.sizeMax) {
            filter[`order.${query.sizeType}`] = { $gte: Number(query.sizeMin), $lte: Number(query.sizeMax) };
        }
    }

    return filter;
};

async function getCitiesFromRange(lat, lng, distance) {
    const MapTesting = require('../mongoModels/mapTesting');
    const rangeDistance = distance * 1609;
    let filter = {
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [lng, lat]
                },
                $maxDistance: rangeDistance
            },
        }
    }
    const list = await MapTesting.find(filter);

    return list;
}