import Vue from 'vue'
import Vuex from 'vuex'
import createLogger from 'vuex/dist/logger'

import { clone } from 'core4ui/core4/helper'
import { createObjectWithDefaultValues } from './helper'
import { jobStates, jobGroups, jobFlags } from './settings.js'

const debug = process.env.NODE_ENV !== 'production'
const plugins = debug ? [createLogger({})] : []

Vue.use(Vuex)

export default new Vuex.Store({
  plugins,
  state: {
    stopChart: true,
    queue: {
      stat: {},
      running: [],
      stopped: [],
      waiting: []
    },
    event: {},
    socket: {
      isConnected: false,
      message: '',
      reconnectError: false
    },
    error: {
      state: false,
      type: 'error',
      message: '',
      slot: ''
    }
  },
  actions: {},
  mutations: {
    SOCKET_ONOPEN (state, event) {
      Vue.prototype.$socket = event.currentTarget
      Vue.prototype.$socket.sendObj({ 'type': 'interest', 'data': ['queue', 'event'] })
      state.socket.isConnected = true
      state.error.state = false
    },
    SOCKET_ONCLOSE (state, event) {
      state.socket.isConnected = false
    },
    SOCKET_ONERROR (state, event) {
      // ToDo: add error flow (message, pop-up etc)
      console.error(state, event)
      // state.error.state = true
      // state.error.type = 'error'
      // state.error.message = 'Cannot connect to the serve.'
    },
    // default handler called for all methods
    SOCKET_ONMESSAGE (state, message) {
      state.socket.message = message

      // summary - ws type notification (all jobs in queue)
      if (message.channel === 'queue') {
        console.log('queue')
        state.queue = groupDataAndJobStat(message.created, message.data, 'state')

        if (state.stopChart) {
          state.event = state.queue.stat
        }

        state.stopChart = false
      }

      if (message.channel === 'event') {
        console.log('event', message.data.queue)
        state.event = message.data.queue
      }
    },
    // mutations for reconnect methods
    SOCKET_RECONNECT (state, count) {
      console.info(state, count)
    },
    SOCKET_RECONNECT_ERROR (state) {
      // ToDo: add error flow (message, pop-up etc)
      state.socket.reconnectError = true
      state.error.state = true
      state.error.type = 'error'
      // state.error.message = 'Cannot connect to the serve.'
      state.error.slot = 'socketReconnectError'
      state.stopChart = true
    }
  },
  getters: {
    ...mapGettersJobGroups(jobGroups), // getter for each job type (pending, deferred, ..., killed)
    stopChart: state => state.stopChart,
    getChartData: state => state.event,
    getJobsByGroupName: (state, getters) => (groupName) => getters[groupName],
    getError: state => state.error,
    getStateCounter: (state) => (stateName) => {
      if (state.queue.stat === undefined) return 0

      return stateName.reduce((previousValue, currentItem) => {
        previousValue += state.queue.stat[currentItem] || 0

        return previousValue
      }, 0)
    }
  }
})

// ================================================================= //
// Private methods
// ================================================================= //

/**
 * Getter(s) for job(s) group from store
 *
 * @param {array} arr -  group(s)
 *                       e.g. ['waiting', 'running', 'stopped']
 *
 * @returns {object} - object with key - group name, value - getter function
 *                     e.g. {'running': (state) => f, ...}
 */
function mapGettersJobGroups (arr) {
  return arr.reduce((computedResult, currentItem) => {
    computedResult[currentItem] = (state) => {
      return clone(state.queue[currentItem] || [])
    }

    return computedResult
  }, {})
}

/**
 * Assort array of all jobs in groups + get job statistic
 *
 * @param {string} created - timestamp
 * @param {array} arr - array of all jobs
 * @param {string} groupingKey - job object key by which we will do grouping
 *
 * @returns {object} - grouped jobs object
 *                     e. g. {'stat': {'waiting': 5, ...}, 'running': [<job>, ..., <job>], ...}
 */
// ToDo: elegant decouple group data and job statistic
function groupDataAndJobStat (created, arr, groupingKey) {
  let groupsDict = {}
  let initialState = createObjectWithDefaultValues(jobStates)

  arr.forEach((job) => {
    if (!job.key) job.key = uniqueKey(job)

    let jobState = job[groupingKey]
    let group = jobStates[jobState] || 'other';

    (groupsDict[group] = groupsDict[group] || []).push(job)

    initialState[jobState] += job['n']
    initialState['created'] = (new Date(created)).getTime()
  })

  return { 'stat': initialState, ...groupsDict }
}

/**
 * Unique key for job
 *
 * @param obj {object} - job
 * @returns {string} - unique_key based on full name, job state and related job flags
 *                     e. g. core.account.xxx.job.monitor.SolChild-pending-zombie-wall
 */
function uniqueKey (obj) {
  let value = `${obj.name}-${obj.state}` // core.account.xxx.job.monitor.SolChild-pending

  for (let key in jobFlags) {
    if (obj[key]) value += `-${key}`
  }

  return value // core.account.xxx.job.monitor.SolChild-pending-zombie-wall
}
