'use strict';

/*
 * Created with @iobroker/create-adapter v2.0.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const request = require('request');

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
		this.killTimeout = null; //AxLED
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		//this.log.info('config option1: ' + this.config.option1);
		//this.log.info('config option2: ' + this.config.option2);
		this.log.debug('Instanz powerfox2 gestartet.')
		this.log.debug('Email: ' + this.config.email);

		//AxlED
		/*
		if (adapter.config.password && (!adapter.supportsFeature || !adapter.supportsFeature('ADAPTER_AUTO_DECRYPT_NATIVE'))) {
			adapter.config.password = tools.decrypt((systemConfig && systemConfig.native && systemConfig.native.secret) || '5Cd6dDqzq8bBbKJ9', adapter.config.password);
		}
		*/
		if (this.config.password && (!this.supportsFeature || !this.supportsFeature('ADAPTER_AUTO_DECRYPT_NATIVE'))) {
			this.config.password = tools.decrypt((systemConfig && systemConfig.native && systemConfig.native.secret) || '5Cd6dDqzq8bBbKJ9', this.config.password);
		}

		if(/[\x00-\x08\x0E-\x1F\x80-\xFF]/.test(this.config.password)){
			this.log.info('Falsches Passwort: Bitte Passwort in den Instanz Einstellungen erneut eingeben.');
			//killAdapter();
		}

		if(!this.config.email || !this.config.password){
			this.log.info('Fehler bei den Anmeldedaten: Bitte zuerst Instanz Einstellungen konfigurieren!');
			//killAdapter();
		}

		if(!(this.config.devices && this.config.devices.length)){
			this.log.info('Fehler bei den Powerfox Geräten: Bitte Geräte in den Instanz Einstellungen prüfen!');
			//killAdapter();
		}
		
		// create basic auth string
		let auth = 'Basic ' + Buffer.from(this.config.email + ':' + this.config.password).toString('base64');
		let dataUrl = "https://backend.powerfox.energy/api/2.0/my/{device}/current";

		for (let i = 0; i < this.config.devices.length; i++) {
			let device = this.config.devices[i];
			//let device = this.config.devices;

			this.log.debug('powerfox2 devices:' + JSON.stringify(device));
			if(device.active){
				let curDataUrl = dataUrl.replace(/{device}/, device.name);
                let path = 'devices.'+createVarName(device.name);

                this.log.debug('Gerätename:' + device.name);
                this.log.debug('Gerät aktiv:' + device.active);
                this.log.debug('Gerät AWS:' + device.aws);
				this.log.debug('Geräte Url:' + curDataUrl);
				
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
						/*
						{
						"Outdated":false,
						"Watt":250.0,
						"Timestamp":1636062444,
						"A_Plus":217153.0,
						"A_Minus":48676.0
						}
						*/
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

			}
		}//Ende for loop

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		
		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		//Delete this.subscribeStates('testVariable');
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates('lights.*');
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates('*');

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		//Delete await this.setStateAsync('testVariable', true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		//Delete await this.setStateAsync('testVariable', { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		//Delete await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		//Delete let result = await this.checkPasswordAsync('admin', 'iobroker');
		//Delete this.log.info('check user admin pw iobroker: ' + result);

		//Delete result = await this.checkGroupAsync('admin', 'admin');
		//Delete this.log.info('check group user admin group admin: ' + result);
		//AxLED
		this.killTimeout = setTimeout(this.stop.bind(this), 15 * 1000); // 15 Seconds
		//AxLED
	}


	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			//AxLED
			if (this.killTimeout) {
                this.log.debug('powerfox2 clearing kill timeout');
                clearTimeout(this.killTimeout);
            }

            this.log.debug('powerfox2 cleaned everything up...');
			//AxLED
			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

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
			//type: 'device',
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

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }

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