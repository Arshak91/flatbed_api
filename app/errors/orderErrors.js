exports.createOrderError = (orders) => {
    let error = false;
    let msg = [];
    for (const [o, order] of orders.entries()) {
        if (!order.products && !order.products.length) {
            error = true;
            msg.push({
                key: "Products",
                msg: `Add products to the Order ${o}.`
            });
        }
        if (order.products && order.products.length) {
            for (const [p, product] of order.products.entries()) {
                if (!product.Quantity) {
                    error = true;
                    msg.push({
                        key: "Quantity",
                        msg: `Add Quantity to the Product ${p}.`
                    });
                }
            }
        }
        if (!order.flowType) {
            error = true;
            msg.push({
                key: "flowType",
                msg: `Add Flow Type to the Order ${o}.`
            });
        }
        if (!order.pickupCompanyName || !order.pickupState || !order.pickupStreetAddress || !order.pickupCountryCode || !order.pickupCity || !order.pickupZip) {
            error = true;
            msg.push({
                key: "pickup Address",
                msg: `Please enter the full address.`
            });
        }
        if (!order.deliveryCompanyName || !order.deliveryState || !order.deliveryStreetAddress || !order.deliveryCountryCode || !order.deliveryCity || !order.deliveryZip) {
            error = true;
            msg.push({
                key: "delivery Address",
                msg: `Please enter the full address.`
            });
        }
        if (!order.pickupdateFrom || !order.pickupdateTo) {
            error = true;
            msg.push({
                key: "pickup date",
                msg: `Add date to the Order ${o}.`
            });
        }
        if (!order.deliverydateFrom || !order.deliverydateTo) {
            error = true;
            msg.push({
                key: "delivery date",
                msg: `Add date to the Order ${o}.`
            });
        }
        if (!order.eqType && order.eqType != 0) {
            error = true;
            msg.push({
                key: "eqType",
                msg: `Add Equipment Type to the Order ${o}.`
            });
        }
    }
    return {
        error,
        msg
    };
};