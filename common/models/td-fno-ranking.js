"use strict";
const app = require("../../server/server");
const _ = require("lodash");
const cron = require("node-cron");
module.exports = function (TdFnoRanking) {
  var getIntradayData = app.datasources.getIntradayData;
  TdFnoRanking.getNiftyRanking = (callback) => {
    const timeHistory = [];
    getIntradayData.getProductList(async (err, responseType) => {
      if (!_.isEmpty(responseType)) {
        console.log(responseType);
        async function fetchData() {
          const listTime = ["MINUTE", "HOUR", "DAY", "WEEK", "MONTH"];
          if (!_.isEmpty(responseType) && responseType.PRODUCTS) {
            await Promise.all(
              responseType.PRODUCTS.slice(16).map(async (type) => {
                try {
                  const responses = await Promise.all(
                    listTime.map(async (timing) => {
                      try {
                        return await new Promise((resolve) => {
                          getIntradayData.GetHistory(
                            timing,
                            type + "-I",
                            10,
                            1,
                            (err, data) => {
                              resolve(data);
                            }
                          );
                        });
                      } catch (error) {
                        console.log(
                          `Error fetching history for ${type} - ${timing}:`,
                          error
                        );
                        return null; // or handle the error accordingly
                      }
                    })
                  );

                  responses.forEach((response2, index) => {
                    if (_.isEmpty(response2)) {
                      console.log(
                        `Error: Empty response2 for ${type} - ${listTime[index]}`
                      );
                    } else {
                      const labelAverage = calculateLabelAverage(
                        response2.OHLC
                      );
                      timeHistory.push({
                        ...labelAverage,
                        type,
                        timing: listTime[index],
                      });
                    }
                  });
                } catch (error) {
                  console.log(`Error fetching data for ${type}:`, error);
                }
              })
            );
            const dataarry = compareAndCreateRanking(timeHistory);
          } else {
            console.log(
              "Error: PRODUCTS is undefined or empty in the response."
            );
            callback("Error: PRODUCTS is undefined or empty in the response.");
          }
        }
        function calculateLabelAverage(OHLC) {
          const labelSum = OHLC.reduce(
            (sum, calculate) => {
              sum.CLOSE += calculate.CLOSE;
              sum.HIGH += calculate.HIGH;
              sum.LOW += calculate.LOW;
              sum.OPEN += calculate.OPEN;
              sum.OPENINTEREST += calculate.OPENINTEREST;
              sum.QUOTATIONLOT += calculate.QUOTATIONLOT;
              sum.TRADEDQTY += calculate.TRADEDQTY;
              return sum;
            },
            {
              CLOSE: 0,
              HIGH: 0,
              LOW: 0,
              OPEN: 0,
              OPENINTEREST: 0,
              QUOTATIONLOT: 0,
              TRADEDQTY: 0,
            }
          );

          const labelAverage = {};
          Object.keys(labelSum).forEach((key) => {
            labelAverage[key] = labelSum[key] / OHLC.length;
          });

          return labelAverage;
        }
        fetchData();
      }
    });
    callback(null, { list: dataarry });
  };
  function compareAndCreateRanking(data) {
    const rankings = [];
    // Iterate over each timing
    const timings = ["MINUTE", "HOUR", "DAY", "WEEK", "MONTH"];
    for (const timing of timings) {
      // Filter data for the current timing
      const timingData = data.filter((item) => item.timing === timing);
      // Sort the filtered data based on OPENINTEREST, QUOTATIONLOT, and TRADEDQTY
      const sortedData = timingData.sort((a, b) => {
        return b.OPENINTEREST - a.OPENINTEREST;
      });
      // Create a ranking object for each type
      for (let i = 0; i < sortedData.length; i++) {
        const type = sortedData[i].type;
        const typeRanking = rankings[i] || { Rank: i + 1 };
        typeRanking[timing] = type;
        rankings[i] = typeRanking;
      }
    }

    return rankings;
  }
  TdFnoRanking.getNiftyRankingTime = (duration, callback) => {
    getIntradayData.getProductList(async (err, responseType) => {
      if (!_.isEmpty(responseType)) {
        async function fetchData() {
          const timeHistory = await Promise.all(
            responseType.PRODUCTS.slice(16).map(async (type) => {
              try {
                const data = await new Promise((resolve, reject) => {
                  getIntradayData.GetHistory(
                    duration,
                    type + "-I",
                    5,
                    1,
                    (err, data) => {
                      if (err || _.isEmpty(data)) {
                        console.log(`Error: Empty response for ${type}`, err);
                        reject(err);
                      } else {
                        resolve(data);
                      }
                    }
                  );
                });

                const labelAverage = calculateLabelAverage(data.OHLC);
                return {
                  ...labelAverage,
                  type,
                  timing: duration,
                };
              } catch (error) {
                console.log(`Error fetching history for ${type}`, error);
                return null; // or handle the error accordingly
              }
            })
          );

          callback(null, timeHistory.filter(Boolean));
        }

        function calculateLabelAverage(OHLC) {
          const labelSum = OHLC.reduce(
            (sum, calculate) => {
              sum.CLOSE += calculate.CLOSE;
              sum.HIGH += calculate.HIGH;
              sum.LOW += calculate.LOW;
              sum.OPEN += calculate.OPEN;
              sum.OPENINTEREST += calculate.OPENINTEREST;
              sum.QUOTATIONLOT += calculate.QUOTATIONLOT;
              sum.TRADEDQTY += calculate.TRADEDQTY;
              return sum;
            },
            {
              CLOSE: 0,
              HIGH: 0,
              LOW: 0,
              OPEN: 0,
              OPENINTEREST: 0,
              QUOTATIONLOT: 0,
              TRADEDQTY: 0,
            }
          );

          const labelAverage = {};
          Object.keys(labelSum).forEach((key) => {
            labelAverage[key] = labelSum[key] / OHLC.length;
          });

          return labelAverage;
        }

        fetchData();
      }
    });
  };
};
