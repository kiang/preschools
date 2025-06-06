# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taiwan Preschools Map (台灣幼兒園地圖) is an interactive web application that visualizes preschool locations across Taiwan with detailed information including fees, facilities, penalty records, and contact details. The project serves as a transparency tool to help parents make informed decisions about preschool selection.

## Architecture

This is a client-side web application built with:
- **OpenLayers 5** for interactive map visualization with WMTS base layers from Taiwan's National Land Surveying and Mapping Center
- **jQuery** for DOM manipulation and UI interactions including autocomplete search
- **Bootstrap 5** for responsive UI components and styling
- **ol5-sidebar** for the collapsible sidebar interface
- **routie.js** for client-side routing and URL hash management

### Key Components

- `index.html` - Main application entry point with sidebar interface and map container
- `js/main.js` - Core application logic including map initialization, feature styling, data loading, and user interactions
- External data sources fetched via AJAX from `kiang.github.io/ap.ece.moe.edu.tw/`

### Data Architecture

The application loads multiple JSON datasets:
- `preschools.json` - Main dataset with all preschool locations and basic information
- `kids_vehicles.json` - School bus/vehicle information
- `punish_all.json` - Penalty records for search functionality
- Individual JSON files for detailed fee information by academic year (109-113)
- Individual JSON files for punishment details and notes

### Map Features

- Color-coded triangular markers indicating preschool types (public, private, semi-public, non-profit, closed)
- Dynamic filtering by city, district, and monthly fee range
- Search functionality for preschool names, owners, addresses, and penalty records
- Geolocation support for user positioning
- Zoom-dependent text labels showing monthly fees (visible at zoom level 15+)

### Data Processing

Monthly fee calculations vary by preschool type:
- Semi-public: 3000 + (after-school care + parent association fees) / months
- Others: Sum of all fee categories divided by number of months
- Special handling for "total semester fee" when available

## Development Notes

This is a static web application that can be served from any web server. The application fetches data from external APIs and does not require a backend server.

## Data Sources

Data is sourced from Taiwan government open data platforms and is regularly updated externally. The application consumes this data via HTTPS requests to the GitHub Pages hosted datasets.