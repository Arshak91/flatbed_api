const verifySignUp = require('./verifySignUp');
const authJwt = require('./verifyJwtToken');

module.exports = app => {
    const authController = require('../mongoControllers/AuthController.js');
    
    const accessorialController = require('../mongoControllers/AccessorialController.js');
    const handlingTypController = require('../mongoControllers/HandlingTypeController.js');
    const settingsController = require('../mongoControllers/SettingsController.js');
    const shiftsController = require('../mongoControllers/ShiftsController.js');
    const jobsController = require('../mongoControllers/JobController.js');
    // const productController = require('../mongoControllers/ProductsController.js');
    // const publicLoadsController = require('../mongoControllers/PublicLoadsController.js');
    const planningController = require('../mongoControllers/PlanningController.js');
    const equipmentController = require('../mongoControllers/EquipmentController.js');
    const apiKeyController = require('../mongoControllers/ApiKeyController.js');
    const upload_controller = require('../mongoControllers/UploadController');


    /***************************************************************** */

    // validations
    const authValidations = require('../validations/Authentication');
    const filtersValidation = require('../validations/Filters');
    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
        res.header("Access-Control-Allow-Headers", "timezone, x-access-token, Origin, Content-Type, Accept");
        next();
    });


    app.post('/auth/signup', [authValidations.SignUp], authController.signUp);
    app.post('/auth/signin', [authValidations.SignIn], authController.signIn);


    app.get('/api/*', [authJwt.verifyToken], (req, res, next) => {
        next();
    });
    app.put('/api/*', [authJwt.verifyToken], (req, res, next) => {
        next();
    });
    app.post('/api/*', [authJwt.verifyToken], (req, res, next) => {
        next();
    });
    app.delete('/api/*', [authJwt.verifyToken], (req, res, next) => {
        next();
    });

    // auth
    app.post('/api/auth/changepassword', authController.changePassword);//
    app.post('/api/auth/signout', authController.signOut);

    // accessorials
    // app.get('/api/accessorials/fill', accessorialController.fill);
    app.get('/api/accessorials/:id', accessorialController.getOne);
    app.get('/api/accessorials', accessorialController.getAll);
    app.post('/api/accessorials', accessorialController.create);
    app.put('/api/accessorials/:id', accessorialController.edit);
    app.delete('/api/accessorials', accessorialController.delete);
    
    // handling types
    // app.get('/api/handlingtypes/fill', handlingTypController.fill);
    app.get('/api/handlingtypes/:id', handlingTypController.getOne);
    app.get('/api/handlingtypes', handlingTypController.getAll);
    app.post('/api/handlingtypes', handlingTypController.create);
    app.put('/api/handlingtypes/:id', handlingTypController.edit);
    app.delete('/api/handlingtypes', handlingTypController.delete);

    // settings
    app.get('/api/settings/userId', settingsController.get);
    // app.get('/api/settings', settings_controller.getAll);
    // app.post('/api/settings', settings_controller.create);
    // app.put('/api/settings', settingsController.edit);
    app.put('/api/fillter', [filtersValidation.CreateFilter], settingsController.addFilter);
    app.put('/api/popFillter', settingsController.removeFilter);
    // app.delete('/api/settings', settings_controller.delete);

    // Shift
    // app.get('/api/shifts/:id', shiftsController.get);
    app.get('/api/shifts', shiftsController.getAll);
    app.get('/shifts', shiftsController.create);
    // app.post('/api/shifts', shiftsController.create);
    // app.put('/api/shifts/:id', shiftsController.edit);
    // app.delete('/api/shifts', shiftsController.delete);

    // job
    app.post('/api/jobs/status', jobsController.status);
    app.get('/api/jobs/:id', jobsController.get);

    // autoplan
    app.post('/autoplan/flatbed', planningController.createPlannings);
    app.get('/api/plannings', planningController.getAll);
    app.get('/api/plannings/:id', planningController.getOne);
    app.post('/api/plannings/delete', planningController.delete);


    // app.get('/api/products', productController.getAll);
    // app.get('/api/products/:id', productController.getOne);

    // app.get('/api/publicloads', publicLoadsController.getAll);
    // app.get('/api/publicloads/:id', publicLoadsController.getOne);


    // // Equipments
    app.get('/api/equipments/forfilter', equipmentController.getAllForFilter);
    // app.get('/api/equipments/eqtype/forselect/:type', equipmentController.getEquipmentsByeqTypeForSelect);
    app.get('/api/equipments/:id', equipmentController.getOne);
    app.get('/api/equipments', equipmentController.getAll);
    app.post('/api/equipments', equipmentController.create);
    app.put('/api/equipments/:id', equipmentController.edit);
    app.delete('/api/equipments', equipmentController.delete);
    app.get('/setEnable', setEnable);
    async function setEnable (req, res) {
        const Equipment = require('../mongoModels/EquipmentModel');
        const list = await Equipment.find();
        await Promise.all(list.map(async item => {
            item.enable = true;
            await item.save();
        }));
        return res.send('sent')
    }
    app.get('/equipment/changeStatus', changeEquipmentsStatus);
    async function changeEquipmentsStatus(req, res) {
        const Equipment = require('../mongoModels/EquipmentModel');
        const item = await Equipment.findById(req.query.id);
        item.enable = !item.enable;
        await item.save();
        return res.send(`${item.enable ? 'item enabled' : 'item disabled'}`)
    }
    // app.get('/api/equipments/capacities', equipmentController.getCapacities);
    // app.get('/api/equipments/type/:type', equipmentController.getallByType);
    // app.get('/api/equipments/eqtype/:type', equipmentController.getEquipmentsByeqType);




// // Upload
    app.get('/api/upload/:id', upload_controller.getOne);

    // // APIKey
    app.post('/apikey', apiKeyController.create);
    app.put('/apikey/:id', apiKeyController.edit);
    app.get('/apikey/:id', apiKeyController.getOne);
    app.get('/apikey', apiKeyController.getAll);
    app.delete('/apikey/:id', apiKeyController.deleteKey);

    

    // /**Test**/
    // app.get('/api/ptest', productController.ProductTest);
};
