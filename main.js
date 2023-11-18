'use strict';

/*
 * Created with @iobroker/create-adapter v2.0.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const axios = require('axios').default;

// Load your modules here, e.g.:
// const fs = require("fs");

class Powerfox2 extends utils.Adapter {

    /**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
    constructor(options) {
        super({
            ...options,
            name: 'powerfox2',
        });
        this.killTimeout = null;
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
	 * Is called when databases are connected and adapter received configuration.
	 */
    async onReady() {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        this.log.debug('instance started.');

        // this line needs further investigation - remove eslint blocker after fixing
        /* eslint-disable-next-line */
        /** if(/[\x00-\x08\x0E-\x1F\x80-\xFF]/.test(this.config.password)){
            this.log.info('Wrong passwort: Please re-enter password in instance settings.');
        }*/

        if(!this.config.email || !this.config.password){
            this.log.info('Error with login datas: Please enter login datas in instance settings.');
        }

        if(!(this.config.devices && this.config.devices.length)){
            this.log.info('Error on powerfox devices: Please check powerfox device in instance settings.');
        }

        this.log.debug('Email: ' + this.config.email);

        // create basic auth string x
        //let auth = 'Basic ' + Buffer.from(this.config.email + ':' + this.config.password).toString('base64');
        const auth = 'Basic ' + Buffer.from(this.config.email + ':' + this.config.password).toString('base64');
        //let dataUrl = 'https://backend.powerfox.energy/api/2.0/my/{device}/current';
        const dataUrl = 'https://backend.powerfox.energy/api/2.0/my/{device}/current';

        for (let i = 0; i < this.config.devices.length; i++) {
            //let device = this.config.devices[i];
            const device = this.config.devices[i];

            this.log.debug('powerfox devices:' + JSON.stringify(device));
            if(device.active){
                //let curDataUrl = dataUrl.replace(/{device}/, device.name);
                const curDataUrl = dataUrl.replace(/{device}/, device.name);
                //let path = 'devices.'+createVarName(device.name);
                const path = 'devices.'+createVarName(device.name);

                this.log.debug('device url:' + curDataUrl);
                this.log.debug('device name:' + device.name);
                this.log.debug('device active:' + device.active);
                this.log.debug('device aws:' + device.aws);

                await axios({
                    method: 'get',
                    url: curDataUrl,
                    headers: {
                        'Authorization': auth
                    },
                    timeout: 10000 // Timeout in milliseconds (adjust as needed)
                })
                    .then(async (result) => {
                        this.log.debug('result status:' + JSON.stringify(result.status));
                        //this.log.debug('powerfox2 result data:' + JSON.stringify(result.data));

                        if (result.status === 200) {
                            //let data = result.data;
                            const data = result.data;
                            this.log.debug('received data: ' + JSON.stringify(data));
                            /**{
							"Outdated":false,
							"Watt":250.0,
							"Timestamp":1636062444,
							"A_Plus":217153.0,
							"A_Plus_HT": 15556.911,
							"A_Plus_NT": 38451.095,
							"A_Minus":48676.0
							}*/
                            let consumption = 0, feedIn = 0;

                            if(data.Watt < 0){
                                feedIn = (data.Watt * -1);
                            } else {
                                consumption = data.Watt;
                            }
                            this.log.debug('feedIn: ' + feedIn);
                            this.log.debug('consumption: ' + consumption);

                            //function fsetObjectNotExistsAsync
                            await this.fsetObjectNotExistsAsync(path + '.deviceType', 'state', 'deviceType', 'string', 'text', '', false, false);
                            await this.setStateAsync(path + '.deviceType', 'POWER', true);
                            await this.fsetObjectNotExistsAsync(path + '.outdated', 'state', 'outdated', 'boolean', 'indicator', '', false, false);
                            await this.setStateAsync(path + '.outdated', data.Outdated, true);
                            await this.fsetObjectNotExistsAsync(path + '.currentPowerConsumption', 'state', 'currentPowerConsumption', 'number', 'value', 'W', false, false);
                            await this.setStateAsync(path + '.currentPowerConsumption', consumption, true);
                            await this.fsetObjectNotExistsAsync(path + '.currentPower', 'state', 'currentPower', 'number', 'value', 'W', false, false);
                            await this.setStateAsync(path + '.currentPower', data.Watt, true);
                            await this.fsetObjectNotExistsAsync(path + '.currentFeedIn', 'state', 'currentFeedIn', 'number', 'value', 'W', false, false);
                            await this.setStateAsync(path + '.currentFeedIn', feedIn, true);
                            await this.fsetObjectNotExistsAsync(path + '.consumptionMeterReadingKWh', 'state', 'consumptionMeterReading', 'number', 'value', 'kWh', false, false);
                            await this.setStateAsync(path + '.consumptionMeterReadingKWh', (data.A_Plus/1000), true);
                            await this.fsetObjectNotExistsAsync(path + '.consumptionMeterReadingHTKWh', 'state', 'consumptionMeterReadingHT', 'number', 'value', 'kWh', false, false);
                            await this.setStateAsync(path + '.consumptionMeterReadingHTKWh', (data.A_Plus_HT/1000), true);
                            await this.fsetObjectNotExistsAsync(path + '.consumptionMeterReadingNTKWh', 'state', 'consumptionMeterReadingNT', 'number', 'value', 'kWh', false, false);
                            await this.setStateAsync(path + '.consumptionMeterReadingNTKWh', (data.A_Plus_NT/1000), true);
                            await this.fsetObjectNotExistsAsync(path + '.feedInMeterReadingKWh', 'state', 'feedInMeterReading', 'number', 'value', 'kWh', false, false);
                            await this.setStateAsync(path + '.feedInMeterReadingKWh', (data.A_Minus/1000), true);
                            await this.fsetObjectNotExistsAsync(path + '.timestamp', 'state', 'DateTime from data', 'string', 'date', '', false, false);
                            //let timestamp = new Date((parseInt(data.Timestamp) || 0) * 1000).toUTCString();
                            const timestamp = new Date((parseInt(data.Timestamp) || 0) * 1000).toUTCString();
                            await this.setStateAsync(path + '.timestamp', timestamp, true);
                        }
                    })
                    .catch(async (error) => {
                        this.log.error('error: ' + error); //AxiosError: Request failed with status code 401
                        this.log.error('error.message: ' + error.message);//Request failed with status code 401
                        if (error.response) {
                            // Die Anfrage wurde gemacht und der Server hat mit einem Statuscode geantwortet
                            // der nicht im Bereich von 2xx liegt.
                            if (error.response.status === 401) {
                                // Hier kannst du spezifische Aktionen für den 401-Statuscode durchführen
                                this.log.error('Error '+error.response.status+': Unauthorized');
                            } else if (error.response.status === 429) {
                                this.log.error('Error '+error.response.status+': Too many requests');
                            } else {
                                this.log.error('error.response.status: ' + error.response.status); //401
                            }
                        }                       
                    });
            }
        }//End for loop
        //this.killTimeout = setTimeout(this.stop.bind(this), 15 * 1000); // 15 Seconds
        this.stop();
    }


    /**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
    onUnload(callback) {
        try {
            if (this.killTimeout) {
                this.log.debug('clearing kill timeout');
                clearTimeout(this.killTimeout);
            }
            this.log.debug('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    //AxLED, Quelle: https://github.com/iobroker-community-adapters/ioBroker.sma-em/blob/master/main.js
    async fsetObjectNotExistsAsync(varname, vartype, varcname, varctype, varcrole, varcunit, varcread, varcwrite) {

        //const setObjectNotExitsPromise = util.promisify(this.setObjectNotExists)
        //let proms = [];
        const proms = [];

        // Create id tree structure ("adapterid.serialnumber.points")
        //let prom = this.setObjectNotExistsAsync(varname, {
        const prom = this.setObjectNotExistsAsync(varname, {
            type: vartype,
            common: {
                name: varcname,
                type: varctype,
                role: varcrole,
                unit: varcunit,
                read: varcread,
                write: varcwrite,
            },
            native: {}
        });
        proms.push(prom);

        // Wait for all object creation processes.
        await Promise.all(proms);
    }
    //AxLED
}

function createVarName(text){
    return text.toLowerCase().replace(/\s/g, '_').replace(/[^\x20\x2D0-9A-Z\x5Fa-z\xC0-\xD6\xF8-\xFF]/g, '');
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
    module.exports = (options) => new Powerfox2(options);
} else {
    // otherwise start the instance directly
    new Powerfox2();
}