import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

const GEOCODING_API_KEY = process.env.GEOCODING_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

app.set("views", path.join(process.cwd(), "views"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));


const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

app.get("/", (req, res) => {
  res.render("index", { 
    weather: null, 
    currentTemperature: null, 
    currentHumidity: null, 
    hourlyForecast: [], 
    weeklyForecast: [],
    airQuality: null,
    error: null 
  });
});

app.post("/weather", async (req, res) => {
  const city = req.body.city;

  try {
    const geoResponse = await axios.get(`https://api.opencagedata.com/geocode/v1/json`, {
      params: { q: city, key: GEOCODING_API_KEY }
    });

    if (geoResponse.data.results.length === 0) {
      return res.render("index", { 
        weather: null, 
        currentTemperature: null,
        currentHumidity: null,
        hourlyForecast: [], 
        weeklyForecast: [],
        airQuality: null,
        error: "City not found. Please enter a valid city." 
      });
    }

    const { lat, lng } = geoResponse.data.results[0].geometry;
    
    const currentWeatherResponse = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
      params: { lat: lat, lon: lng, appid: WEATHER_API_KEY, units: "metric" }
    });
  
    const currentTemperature = currentWeatherResponse.data.main.temp;
    const currentHumidity = currentWeatherResponse.data.main.humidity;

    const weatherResponse = await axios.get(`https://api.openweathermap.org/data/2.5/forecast`, {
      params: { lat: lat, lon: lng, appid: WEATHER_API_KEY, units: "metric" }
    });

    const airQualityResponse = await axios.get(`https://api.openweathermap.org/data/2.5/air_pollution`, {
      params: { lat: lat, lon: lng, appid: WEATHER_API_KEY, units: "metric" }
    });
    const airQuality = {
      aqi: airQualityResponse.data.list[0].main.aqi,
      components: airQualityResponse.data.list[0].components
    };

    const hourlyForecast = weatherResponse.data.list.slice(0, 8).map(entry => {
      const utcDate = new Date(entry.dt * 1000);
      const localDate = new Date(utcDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

      return {
        time: localDate.toLocaleTimeString("en-US", { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        }),
        temperature: Math.round(entry.main.temp),
        humidity: entry.main.humidity,
        icon: entry.weather[0].icon
      };
    });

    const forecastData = weatherResponse.data.list.map(entry => {
      const utcDate = new Date(entry.dt * 1000);
      const localDate = new Date(utcDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      
      return {
        time: localDate.toLocaleTimeString("en-US", { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        }),
        date: formatDate(localDate),
        temperature: Math.round(entry.main.temp),
        humidity: entry.main.humidity,
        icon: entry.weather[0].icon
      };
    });

    const weeklyForecast = [];
    const uniqueDates = new Set();

    forecastData.forEach(entry => {
      const dateKey = entry.date;
      if (!uniqueDates.has(dateKey) && uniqueDates.size < 5) {
        uniqueDates.add(dateKey);
        weeklyForecast.push({
          date: dateKey,
          temperature: entry.temperature,
          humidity: entry.humidity,
          icon: entry.icon
        });
      }
    });

    res.render("index", { 
      weather: `Weather in ${city}: ${currentWeatherResponse.data.weather[0].description}`,
      currentTemperature: `${currentTemperature}°C`,
      currentHumidity: `${currentHumidity}%`,
      hourlyForecast,
      weeklyForecast,
      airQuality,
      error: null 
    });

  } catch (error) {
    console.error("Weather API Error:", error.response ? error.response.data : error.message);
    res.render("index", { 
      weather: null, 
      currentTemperature: null,
      currentHumidity: null,
      hourlyForecast: [], 
      weeklyForecast: [],
      airQuality: null,
      error: "Error fetching weather data. Please try again later." 
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});