'use strict';

/*
 * Created with @iobroker/create-adapter v2.0.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
//const request = require('request');
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
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.debug('Instanz powerfox2 gestartet.');
		this.log.debug('Email: ' + this.config.email);

		if (this.config.password && (!this.supportsFeature || !this.supportsFeature('ADAPTER_AUTO_DECRYPT_NATIVE'))) {
			this.config.password = tools.decrypt((systemConfig && systemConfig.native && systemConfig.native.secret) || '5Cd6dDqzq8bBbKJ9', this.config.password);
		}

		if(/[\x00-\x08\x0E-\x1F\x80-\xFF]/.test(this.config.password)){
			this.log.info('Falsches Passwort: Bitte Passwort in den Instanz Einstellungen erneut eingeben.');
		}

		if(!this.config.email || !this.config.password){
			this.log.info('Fehler bei den Anmeldedaten: Bitte zuerst Instanz Einstellungen konfigurieren!');
		}

		if(!(this.config.devices && this.config.devices.length)){
			this.log.info('Fehler bei den Powerfox Geräten: Bitte Geräte in den Instanz Einstellungen prüfen!');
		}
		
		// create basic auth string x
		let auth = 'Basic ' + Buffer.from(this.config.email + ':' + this.config.password).toString('base64');
		let dataUrl = "https://backend.powerfox.energy/api/2.0/my/{device}/current";

		for (let i = 0; i < this.config.devices.length; i++) {
			let device = this.config.devices[i];

			this.log.debug('powerfox2 devices:' + JSON.stringify(device));
			if(device.active){
				let curDataUrl = dataUrl.replace(/{device}/, device.name);
                let path = 'devices.'+createVarName(device.name);

                this.log.debug('Gerätename:' + device.name);
                this.log.debug('Gerät aktiv:' + device.active);
                this.log.debug('Gerät AWS:' + device.aws);
				this.log.debug('Geräte Url:' + curDataUrl);
				
				/*Axled axios
				axios.get('https://api.github.com/user', {
  					headers: {
    					'Authorization': `token ${access_token}`
  					}
				})
				.then((res) => {
					console.log(res.data)
				})
				.catch((error) => {
					console.error(error)
				})
				*/
				//Axled axios

				
				//Axled axios2
				await axios({
					method: 'get',
					url: curDataUrl, 
					headers: { 
						'Authorization': auth
					} 
				})
				.then(async (result) => {
					//console.log(result.data)
					this.log.info('test axios status' + JSON.stringify(result.status));
					this.log.info('test axios' + JSON.stringify(result.data));
					
					
					if (result.status === 200) {
						//let data = JSON.parse(result.data);
						let data = result.data;
						this.log.debug('powerfox2 received data: ' + JSON.stringify(data));
						//this.log.debug('powerfox2 received data: ' + JSON.stringify(result.data));
						
						//{
						//"Outdated":false,
						//"Watt":250.0,
						//"Timestamp":1636062444,
						//"A_Plus":217153.0,
						//"A_Minus":48676.0
						//}
						var consumption = 0, feedIn = 0;

						if(data.Watt < 0){
							feedIn = (data.Watt * -1);
						} else {
							consumption = data.Watt;
						}
						this.log.debug('feedIn: ' + feedIn);
						this.log.debug('consumption: ' + consumption);

						//Test function fsetObjectNotExistsAsync
						await this.fsetObjectNotExistsAsync(path + '.deviceType', 'state', 'deviceType', 'string', 'text', '', false, false);
						this.subscribeStates(path + '.deviceType');
						await this.setStateAsync(path + '.deviceType', 'POWER', true);

						await this.fsetObjectNotExistsAsync(path + '.outdated', 'state', 'outdated', 'boolean', 'indicator.outdated', '', false, false);
						this.subscribeStates(path + '.outdated');
						await this.setStateAsync(path + '.outdated', data.Outdated, true);

						await this.fsetObjectNotExistsAsync(path + '.currentPowerConsumption', 'state', 'currentPowerConsumption', 'number', 'value', 'W', false, false);
						this.subscribeStates(path + '.currentPowerConsumption');
						await this.setStateAsync(path + '.currentPowerConsumption', consumption, true);
						
						await this.fsetObjectNotExistsAsync(path + '.currentPower', 'state', 'currentPower', 'number', 'value', 'W', false, false);
						this.subscribeStates(path + '.currentPower');
						await this.setStateAsync(path + '.currentPower', data.Watt, true);
	
						await this.fsetObjectNotExistsAsync(path + '.currentFeedIn', 'state', 'currentFeedIn', 'number', 'value', 'W', false, false);
						this.subscribeStates(path + '.currentFeedIn');
						await this.setStateAsync(path + '.currentFeedIn', feedIn, true);

						await this.fsetObjectNotExistsAsync(path + '.consumptionMeterReadingKWh', 'state', 'consumptionMeterReading', 'number', 'value', 'kWh', false, false);
						this.subscribeStates(path + '.consumptionMeterReadingKWh');
						await this.setStateAsync(path + '.consumptionMeterReadingKWh', (data.A_Plus/1000), true);

						//await this.fsetObjectNotExistsAsync(path + '.consumptionMeterReadingWh', 'state', 'consumption meter reading', 'number', 'value', 'Wh', false, false);
						//this.subscribeStates(path + '.consumptionMeterReadingWh');
						//await this.setStateAsync(path + '.consumptionMeterReadingWh', data.A_Plus, true);

						await this.fsetObjectNotExistsAsync(path + '.feedInMeterReadingKWh', 'state', 'feedInMeterReading', 'number', 'value', 'kWh', false, false);
						this.subscribeStates(path + '.feedInMeterReadingKWh');
						await this.setStateAsync(path + '.feedInMeterReadingKWh', (data.A_Minus/1000), true);

						//await this.fsetObjectNotExistsAsync(path + '.feedInMeterReadingWh', 'state', 'feed in meter reading', 'number', 'value', 'Wh', false, false);
						//this.subscribeStates(path + '.feedInMeterReadingWh');
						//await this.setStateAsync(path + '.feedInMeterReadingWh', data.A_Minus, true);

						await this.fsetObjectNotExistsAsync(path + '.timestamp', 'state', 'DateTime from data', 'string', 'date', '', false, false);
						this.subscribeStates(path + '.timestamp');
						let timestamp = new Date((parseInt(data.Timestamp) || 0) * 1000).toUTCString();
						await this.setStateAsync(path + '.timestamp', timestamp, true);
						
					}
					
				})
				.catch(async (error) => {
					//console.error(error)
					//this.log.info('test axios error' + error);
					//this.log.error(JSON.stringify(error))
					this.log.error('test axios error ' + error);
				});
				//Axled axios2

				//Axled request
				/*
				request({
					method: 'GET',
					url: curDataUrl,
					headers : {
						"Authorization" : auth
					}
				}, async (error, response, body) => {
					if (!error && response.statusCode === 200) {
						let data = JSON.parse(body);
						this.log.debug('powerfox2 received data: ' + JSON.stringify(data));
						
						//{
						//"Outdated":false,
						//"Watt":250.0,
						//"Timestamp":1636062444,
						//"A_Plus":217153.0,
						//"A_Minus":48676.0
						//}

						var consumption = 0, feedIn = 0;

						if(data.Watt < 0){
							feedIn = (data.Watt * -1);
						} else {
							consumption = data.Watt;
						}
						this.log.debug('feedIn: ' + feedIn);
						this.log.debug('consumption: ' + consumption);

						//Test function fsetObjectNotExistsAsync
						await this.fsetObjectNotExistsAsync(path + '.currentPower', 'state', 'current power (W)', 'number', 'value', 'W', false, false);
						this.subscribeStates(path + '.currentPower');
						await this.setStateAsync(path + '.currentPower', data.Watt, true);

						await this.fsetObjectNotExistsAsync(path + '.currentPowerConsumption', 'state', 'current power consumption (W)', 'number', 'value', 'W', false, false);
						this.subscribeStates(path + '.currentPowerConsumption');
						await this.setStateAsync(path + '.currentPowerConsumption', consumption, true);

						await this.fsetObjectNotExistsAsync(path + '.currentFeedIn', 'state', 'current feed in (W)', 'number', 'value', 'W', false, false);
						this.subscribeStates(path + '.currentFeedIn');
						await this.setStateAsync(path + '.currentFeedIn', feedIn, true);

						await this.fsetObjectNotExistsAsync(path + '.consumptionMeterReadingKWh', 'state', 'consumption meter reading (KWh)', 'number', 'value', 'kWh', false, false);
						this.subscribeStates(path + '.consumptionMeterReadingKWh');
						await this.setStateAsync(path + '.consumptionMeterReadingKWh', (data.A_Plus/1000), true);

						await this.fsetObjectNotExistsAsync(path + '.consumptionMeterReadingWh', 'state', 'consumption meter reading (Wh)', 'number', 'value', 'Wh', false, false);
						this.subscribeStates(path + '.consumptionMeterReadingWh');
						await this.setStateAsync(path + '.consumptionMeterReadingWh', data.A_Plus, true);

						await this.fsetObjectNotExistsAsync(path + '.feedInMeterReadingKWh', 'state', 'feed in meter reading (KWh)', 'number', 'value', 'kWh', false, false);
						this.subscribeStates(path + '.feedInMeterReadingKWh');
						await this.setStateAsync(path + '.feedInMeterReadingKWh', (data.A_Minus/1000), true);

						await this.fsetObjectNotExistsAsync(path + '.feedInMeterReadingWh', 'state', 'feed in meter reading (Wh)', 'number', 'value', 'Wh', false, false);
						this.subscribeStates(path + '.feedInMeterReadingWh');
						await this.setStateAsync(path + '.feedInMeterReadingWh', data.A_Minus, true);

						await this.fsetObjectNotExistsAsync(path + '.timestamp', 'state', 'DateTime from data', 'string', 'date', '', false, false);
						this.subscribeStates(path + '.timestamp');
						let timestamp = new Date((parseInt(data.Timestamp) || 0) * 1000).toUTCString();
						await this.setStateAsync(path + '.timestamp', timestamp, true);

						await this.fsetObjectNotExistsAsync(path + '.type', 'state', 'device type', 'string', 'text', '', false, false);
						this.subscribeStates(path + '.type');
						await this.setStateAsync(path + '.type', 'POWER', true);
					}
				});
				*/
				//Axled request

			}
		}//Ende for loop

		this.killTimeout = setTimeout(this.stop.bind(this), 15 * 1000); // 15 Seconds
	}


	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.killTimeout) {
                this.log.debug('powerfox2 clearing kill timeout');
                clearTimeout(this.killTimeout);
            }
            this.log.debug('powerfox2 cleaned everything up...');
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.debug(`state ${id} deleted`);
		}
	}

	//AxLED, Quelle: https://github.com/iobroker-community-adapters/ioBroker.sma-em/blob/master/main.js
	async fsetObjectNotExistsAsync(varname, vartype, varcname, varctype, varcrole, varcunit, varcread, varcwrite) {
		
		//const setObjectNotExitsPromise = util.promisify(this.setObjectNotExists)
		let proms = [];

		// Create id tree structure ("adapterid.serialnumber.points")
		let prom = this.setObjectNotExistsAsync(varname, {
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