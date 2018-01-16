import _ from '../lodash-custom-bundle';
import numeral from 'numeral';
import utils from '../utils';

class GraphModel {
    constructor (configuration) {
        this.config = configuration;

        if (this.config.type === 'list') {
            return;
        }

        this.breakdowns = utils.cloneDeep(this.config.breakdowns || []);
        // insert a "total" breakdown as a default breakdown
        this.breakdowns.splice(0, 0, {
            total: true,
            name: 'Total',
            // this undefined is meaningful as a second parameter to DimensionalData.breakdown
            breakdownName: null,
            values: [
                { name: 'total', on: true, key: 'total' },
            ],
        })
        this.activeBreakdown = this.breakdowns[0];

        // TODO: maybe make this dynamic when the breakdown is activated?
        // Remove dimension values that have no data.
        /*
        this.breakdowns.forEach(breakdown => {
            const dimensionValues = this.data.getDimensionValues(breakdown.breakdownName);
            breakdown.values = _.filter(breakdown.values, item => dimensionValues.includes(item.key));
        });
        */

        this.graphData = [];
    }

    setData (data) {
        this.data = data;

        if (['list', 'map'].includes(this.config.type)) {
            this.graphData = this.topXByY();
            return;
        }
        const xAxisValue = 'timestamp';
        const yAxisValue = this.config.value;

        this.data.measure(xAxisValue);
        const rawValues = this.data.breakdown(yAxisValue, this.activeBreakdown.breakdownName);

        this.graphData = rawValues.map((row) => {
            var ts = row.timestamp;
            const month = createDate(ts);
            return {month: month, total: row[yAxisValue]};
        });
    }

    refreshData () {
        this.setData(this.data);
    }

    get area () {
        return this.config.area;
    }
    get darkColor () {
        return this.config.darkColor;
    }

    getAggregateLabel () {
        return this.config.additive ? 'Total' : 'Average';
    }

    getAggregate () {
        return this.getLimitedAggregate();
    }

    getLimitedAggregate (limitToLastN) {
        const values = this.getAggregatedValues(limitToLastN);
        const total = _.sum(values);
        const average = _.round(total / values.length, 1);

        return this.config.additive ? total : average;
    }

    getAggregatedValues (limitToLastN) {
        const activeDict = this.getActiveBreakdownValues();
        const values = this.graphData.map((d) => {
            return _.sum(_.map(d.total, (breakdownValue, key) => {
                return key in activeDict ? breakdownValue : 0;
            }));
        });
        const limit = Math.min(limitToLastN || values.length, values.length);
        return _.take(values, limit);
    }

    getActiveBreakdownValues () {
        const actives = this.activeBreakdown.values.filter(bv => bv.on).map(bv => bv.key);
        return actives.reduce((r, a) => { r[a] = true; return r; }, {});
    }

    getMinMax () {
        const activeDict = this.getActiveBreakdownValues();
        let min = 0;
        let max = 0;

        _.forEach(this.graphData, d => {
            const active = _.toPairs(d.total).filter(r => r[0] in activeDict).map(r => r[1]);
            min = Math.min(min, _.min(active));
            max = Math.max(max, _.max(active));
        });

        return { min, max };
    }

    topXByY (limit) {
        const x = this.config.key;
        const y = this.config.value;

        this.data.measure(x);
        const results = this.data.breakdown(y);
        return _.take(_.sortBy(results, (row) => row[y].total).reverse(), limit || results.length);
    }

    formatNumberForMetric (number) {
        if (this.config.unit === 'bytes') {
            return numeral(number).format('0,0b');
        } else {
            return numeral(number).format('0,0a');
        }
    }
}

function createDate(timestamp) {
    if (timestamp.length <= 10) {
        return new Date(timestamp.slice(0,4) + '-'
                        + timestamp.slice(4,6) + '-'
                        + timestamp.slice(6,8));
    } else {
        return new Date(timestamp);
    }
}

export default GraphModel;
