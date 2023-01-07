const osrm = require('../controller/osmap.controller');
const Shift = require('../mongoModels/ShiftModel');
module.exports = class Stops {
    constructor(params) {
        this.data = params.data;
    }

    async calculation() {
        let { stopLocations, noHos } = this.data, LatLon = '', shiftName;
        if (noHos) {
            shiftName = 'Team';
        } else {
            shiftName = 'Weekly';
        }
        for (const stop of stopLocations) {
            LatLon += `${stop.lat},${stop.lon};`;
        }
        let { distDur, status, code, msg } = await osrm.GetDistDur(LatLon);
        let { legs } = distDur, totalDur = 0, durForBreak = 0, durForRecharge = 0, br_shift = 0;
        let shift = await Shift.findOne({
            shiftName: shiftName
        });
        br_shift = shift.break_time/shift.shift;
        if (legs && legs.length) {
            for (const [l, leg] of legs.entries()) {
                stopLocations[l].ordersMobile.forEach(el => {
                    totalDur += el.order.servicetime ? el.order.servicetime : 1;
                    durForBreak += el.order.servicetime ? el.order.servicetime : 1;
                    durForRecharge += el.order.servicetime ? el.order.servicetime : 1;
                });
                totalDur += leg.duration;
                durForBreak += leg.duration;
                durForRecharge += leg.duration;
                if (durForBreak > shift.break_time) {
                    let breakCount = Math.floor(durForBreak/shift.shift) ? Math.floor(durForBreak/shift.shift) : 1;
                    if (Math.floor(durForBreak/shift.shift) && (durForBreak/shift.shift - breakCount) >= br_shift) {
                        breakCount += 1;
                    }
                    totalDur += (breakCount * shift.rest);
                    durForBreak = 0;
                }
                if (durForRecharge > shift.shift) {
                    totalDur += (Math.floor(durForRecharge/shift.shift) * shift.recharge);
                    durForRecharge = 0;
                }
            }
        }
        return { distDur, totalDur };
    }
};