import '../assets/css/Photon.css';
import '../assets/css/App.css';
import React, { Component } from 'react';
const {ipcRenderer, remote} = window.require('electron')
import batteryLevelIcon from './helpers/battery-level-icon'
import App from './App';
import Login from './Login';

class Home extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
          firstData: false,
          loading: true,
          error: false,
          auth:false,
        }
      }

      componentDidMount() {

        ipcRenderer.on('login', function (event, isLogged) {
          if(isLogged){
            this.setState({auth:true})
            return
          }
          this.setState({auth:false})

        }.bind(this))

        ipcRenderer.on('tesla-data-error', function (event,store) {
          if(!this.state.firstData){
            this.setState({
              error:store
            })
          }
    
        }.bind(this))
    
        ipcRenderer.on('tesla-data', function (event,store) {
          this.setState({
            loading:false,
            firstData:true,
            batteryIcon: batteryLevelIcon(store.chargeState.battery_level),
            vehicle:{
              model: store.vehicle.model,
              state: store.vehicle.state
            },
            status:{
              batteryRange: store.chargeState ? store.chargeState.battery_range: null,
              batteryLevel: store.chargeState ? store.chargeState.battery_level: null,
              locked: true,
              fan: store.climateState ? store.climateState.is_climate_on : null,
              speed: store.driveState? store.driveState.speed : null,
              chargingState: store.chargeState ? store.chargeState.charging_state : null,
              temperature: store.climateState ? store.climateState.inside_temp: null,
              location: {lat: store.driveState?store.driveState.latitude:null, lng: store.driveState? store.driveState.longitude : null},
            }
          });
        }.bind(this));
      }

      componentWillUnmount(){
        ipcRenderer.removeAllListeners()
      }

  render() {

    if(!this.state.auth){
      return (
        <div>
        <div className="header-arrow"></div>
        <div className="window">
        <header className="toolbar toolbar-header"/>
        <div className="window-content">
          <div className="pane">
          <Login {...this.state} />
        </div>
        </div>
          </div>
          </div>
    )
  }

        return (
        <div>
          <div className="header-arrow"></div>
          <div className="window">
          <header className="toolbar toolbar-header"/>
          <div className="window-content">
            <div className="pane">
            <App {...this.state} />
          </div>
          </div>
            </div>
            </div>
        )
  }
}

export default Home;
