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

        this.log.debug('instance started.');

        // this line needs further investigation - remove eslint blocker after fixing
        /* eslint-disable-next-line */
        /** if(/[\x00-\x08\x0E-\x1F\x80-\xFF]/.test(this.config.password)){
            this.log.info('Wrong passwort: Please re-enter password in instance settings.');
        }*/

        // --- ÄNDERUNG [WICHTIG #3]: log.info → log.error + return, damit der Adapter sofort stoppt ---
        // ALTCODE:
        // if(!this.config.email || !this.config.password){
        //     this.log.info('Error with login datas: Please enter login datas in instance settings.');
        // }
        // if(!(this.config.devices && this.config.devices.length)){
        //     this.log.info('Error on powerfox devices: Please check powerfox device in instance settings.');
        // }
        // NEUCODE:
        if (!this.config.email || !this.config.password) {
            this.log.error('Error with login datas: Please enter login datas in instance settings.');
            return;
        }
        if (!(this.config.devices && this.config.devices.length)) {
            this.log.error('Error on powerfox devices: Please check powerfox device in instance settings.');
            return;
        }
        // --- ENDE ÄNDERUNG ---

        this.log.debug('Email: ' + this.config.email);

        // --- ÄNDERUNG [NICE TO HAVE #7]: Axios-Instanz vorkonfigurieren ---
        // ALTCODE:
        // const auth = 'Basic ' + Buffer.from(this.config.email + ':' + this.config.password).toString('base64');
        // const dataUrl = 'https://backend.powerfox.energy/api/2.0/my/{device}/current';
        // NEUCODE:
        const auth = 'Basic ' + Buffer.from(this.config.email + ':' + this.config.password).toString('base64');
        const apiClient = axios.create({
            baseURL: 'https://backend.powerfox.energy/api/2.0/my/',
            timeout: 15000,
            headers: { 'Authorization': auth }
        });
        // --- ENDE ÄNDERUNG ---

        for (let i = 0; i < this.config.devices.length; i++) {
            const device = this.config.devices[i];

            this.log.debug('powerfox devices:' + JSON.stringify(device));
            if (device.active) {
                // --- ÄNDERUNG [NICE TO HAVE #7]: dataUrl entfällt, da apiClient verwendet wird ---
                // ALTCODE:
                // const curDataUrl = dataUrl.replace(/{device}/, device.name);
                // NEUCODE:
                const curDataUrl = device.name + '/current';
                // --- ENDE ÄNDERUNG ---

                const path = 'devices.' + createVarName(device.name);

                this.log.debug('device url:' + curDataUrl);
                this.log.debug('device name:' + device.name);
                this.log.debug('device active:' + device.active);
                this.log.debug('device aws:' + device.aws);

                // --- ÄNDERUNG [WICHTIG #1]: await + .then/.catch durch try/catch ersetzen ---
                // ALTCODE: (siehe vorherige Version)
                // NEUCODE:
                try {
                    const result = await apiClient.get(curDataUrl);

                    this.log.debug('result status:' + JSON.stringify(result.status));

                    if (result.status === 200) {
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

                        // --- ÄNDERUNG [WICHTIG #2]: Validierung der API-Antwortdaten ---
                        // ALTCODE: (keine Validierung vorhanden)
                        // NEUCODE:
                        if (data.Watt === undefined || data.A_Plus === undefined) {
                            this.log.error('Incomplete data received for device: ' + device.name);
                            continue;
                        }
                        // --- ENDE ÄNDERUNG ---

                        let consumption = 0, feedIn = 0;

                        if (data.Watt < 0) {
                            feedIn = (data.Watt * -1);
                        } else {
                            consumption = data.Watt;
                        }
                        this.log.debug('feedIn: ' + feedIn);
                        this.log.debug('consumption: ' + consumption);

                        // --- ÄNDERUNG [NICE TO HAVE #8 REVERT]: Timestamp zurück als UTC-String (string) ---
                        // wegen bestehendem State-Typ in ioBroker-Datenbank (wurde als string angelegt)
                        // ALTCODE (number):
                        // const timestamp = (parseInt(data.Timestamp) || 0) * 1000;
                        // NEUCODE (string):
                        const timestamp = new Date((parseInt(data.Timestamp) || 0) * 1000).toUTCString();
                        // --- ENDE ÄNDERUNG ---

                        // --- ÄNDERUNG [OPTIMIERUNG #1]: Objekte nur anlegen wenn noch nicht vorhanden,
                        // einmalige Prüfung anhand eines einzelnen States statt 10x fsetObjectNotExistsAsync ---
                        // ALTCODE:
                        // await this.fsetObjectNotExistsAsync(path + '.deviceType', ...);
                        // await this.setStateAsync(path + '.deviceType', 'POWER', true);
                        // await this.fsetObjectNotExistsAsync(path + '.outdated', ...);
                        // await this.setStateAsync(path + '.outdated', data.Outdated, true);
                        // ... (10x sequenziell)
                        // NEUCODE:
                        const existingState = await this.getStateAsync(path + '.deviceType');
                        if (!existingState) {
                            // Objekte nur beim ersten Mal anlegen (sequenziell notwendig)
                            this.log.debug('creating objects for device: ' + device.name);
                            await this.fsetObjectNotExistsAsync(path + '.deviceType', 'state', 'deviceType', 'string', 'text', '', false, false);
                            await this.fsetObjectNotExistsAsync(path + '.outdated', 'state', 'outdated', 'boolean', 'indicator', '', false, false);
                            await this.fsetObjectNotExistsAsync(path + '.currentPowerConsumption', 'state', 'currentPowerConsumption', 'number', 'value', 'W', false, false);
                            await this.fsetObjectNotExistsAsync(path + '.currentPower', 'state', 'currentPower', 'number', 'value', 'W', false, false);
                            await this.fsetObjectNotExistsAsync(path + '.currentFeedIn', 'state', 'currentFeedIn', 'number', 'value', 'W', false, false);
                            await this.fsetObjectNotExistsAsync(path + '.consumptionMeterReadingKWh', 'state', 'consumptionMeterReading', 'number', 'value', 'kWh', false, false);
                            await this.fsetObjectNotExistsAsync(path + '.consumptionMeterReadingHTKWh', 'state', 'consumptionMeterReadingHT', 'number', 'value', 'kWh', false, false);
                            await this.fsetObjectNotExistsAsync(path + '.consumptionMeterReadingNTKWh', 'state', 'consumptionMeterReadingNT', 'number', 'value', 'kWh', false, false);
                            await this.fsetObjectNotExistsAsync(path + '.feedInMeterReadingKWh', 'state', 'feedInMeterReading', 'number', 'value', 'kWh', false, false);
                            // ALTCODE (number): await this.fsetObjectNotExistsAsync(path + '.timestamp', 'state', 'DateTime from data', 'number', 'date', '', false, false);
                            // NEUCODE (string): passend zum bestehenden State-Typ in ioBroker
                            await this.fsetObjectNotExistsAsync(path + '.timestamp', 'state', 'DateTime from data', 'string', 'date', '', false, false);
                        }
                        // --- ENDE ÄNDERUNG ---

                        // --- ÄNDERUNG [OPTIMIERUNG #2]: alle States parallel schreiben mit Promise.all ---
                        // ALTCODE:
                        // await this.setStateAsync(path + '.deviceType', 'POWER', true);
                        // await this.setStateAsync(path + '.outdated', data.Outdated, true);
                        // await this.setStateAsync(path + '.currentPowerConsumption', consumption, true);
                        // await this.setStateAsync(path + '.currentPower', data.Watt, true);
                        // await this.setStateAsync(path + '.currentFeedIn', feedIn, true);
                        // await this.setStateAsync(path + '.consumptionMeterReadingKWh', (data.A_Plus / 1000), true);
                        // await this.setStateAsync(path + '.consumptionMeterReadingHTKWh', (data.A_Plus_HT / 1000), true);
                        // await this.setStateAsync(path + '.consumptionMeterReadingNTKWh', (data.A_Plus_NT / 1000), true);
                        // await this.setStateAsync(path + '.feedInMeterReadingKWh', (data.A_Minus / 1000), true);
                        // await this.setStateAsync(path + '.timestamp', timestamp, true);
                        // NEUCODE:
                        await Promise.all([
                            this.setStateAsync(path + '.deviceType', 'POWER', true),
                            this.setStateAsync(path + '.outdated', data.Outdated, true),
                            this.setStateAsync(path + '.currentPowerConsumption', consumption, true),
                            this.setStateAsync(path + '.currentPower', data.Watt, true),
                            this.setStateAsync(path + '.currentFeedIn', feedIn, true),
                            this.setStateAsync(path + '.consumptionMeterReadingKWh', (data.A_Plus / 1000), true),
                            this.setStateAsync(path + '.consumptionMeterReadingHTKWh', (data.A_Plus_HT / 1000), true),
                            this.setStateAsync(path + '.consumptionMeterReadingNTKWh', (data.A_Plus_NT / 1000), true),
                            this.setStateAsync(path + '.feedInMeterReadingKWh', (data.A_Minus / 1000), true),
                            this.setStateAsync(path + '.timestamp', timestamp, true),
                        ]);
                        // --- ENDE ÄNDERUNG ---
                    }
                } catch (error) {
                    this.log.error('error: ' + error);
                    this.log.error('error.message: ' + error.message);
                    if (error.response) {
                        if (error.response.status === 401) {
                            this.log.error('Error ' + error.response.status + ': Unauthorized');
                        } else if (error.response.status === 429) {
                            this.log.warn('Error ' + error.response.status + ': Too many requests');
                        } else {
                            this.log.error('error.response.status: ' + error.response.status);
                        }
                    } else if (error.code === 'ECONNABORTED') {
                        this.log.warn('Request timeout for device: ' + device.name);
                    }
                }
                // --- ENDE ÄNDERUNG ---
            }
        } // End for loop

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

    // --- ÄNDERUNG [MITTEL #4]: fsetObjectNotExistsAsync vereinfacht (proms-Array entfernt) ---
    // ALTCODE:
    // async fsetObjectNotExistsAsync(varname, vartype, varcname, varctype, varcrole, varcunit, varcread, varcwrite) {
    //     const proms = [];
    //     const prom = this.setObjectNotExistsAsync(varname, {
    //         type: vartype,
    //         common: {
    //             name: varcname,
    //             type: varctype,
    //             role: varcrole,
    //             unit: varcunit,
    //             read: varcread,
    //             write: varcwrite,
    //         },
    //         native: {}
    //     });
    //     proms.push(prom);
    //     await Promise.all(proms);
    // }
    // NEUCODE:
    //AxLED, Quelle: https://github.com/iobroker-community-adapters/ioBroker.sma-em/blob/master/main.js
    async fsetObjectNotExistsAsync(varname, vartype, varcname, varctype, varcrole, varcunit, varcread, varcwrite) {
        await this.setObjectNotExistsAsync(varname, {
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
    }
    // --- ENDE ÄNDERUNG ---
    //AxLED
}

function createVarName(text) {
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
