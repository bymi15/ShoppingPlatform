var config = {
    development: {
        databaseURI: 'localhost:27017/shoppingplatform',
        stripe_client_id: 'ca_AxQsVkEHOuVczyLUN0Ds8ODiarYMFhnR',
        stripe_client_secret: 'sk_test_ke8tFhRucEszDcMSITqbLylj'
    },
    production: {
        databaseURI: 'dbuser:dbuser123@ds139122.mlab.com:39122/heroku_wjmqlnqn',
        stripe_client_id: 'ca_AxQsKmiySsA1vXM7gav41MeRSAGjHIZw',
        stripe_client_secret: 'sk_live_I5aufI9wONydgJTyg85OA44h'
    }
};
module.exports = config;
