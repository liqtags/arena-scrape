import dotenv from 'npm:dotenv';
dotenv.config();
import axios from 'npm:axios';
import * as fs from 'node:fs';

/**
 * User data interface representing the structure of each user object
 */
interface User {
  [key: string]: any; // Generic type since actual user fields aren't specified
}

/**
 * Response data structure for saving to file
 */
interface ResponseData {
  total_users: number;
  timestamp: string;
  users: User[];
}

/**
 * Fetches user data from the API with pagination handling and rate limiting.
 * 
 * @param baseUrl - Base URL of the API endpoint
 * @param batchSize - Number of users per request (default 50 as per API)
 * @param totalUsers - Total number of users to fetch
 * @param rateLimitDelay - Delay between requests in milliseconds
 * @returns Promise resolving to a list of user data objects
 */
async function fetchUserData(
  baseUrl: string, 
  batchSize: number = 50, 
  totalUsers: number = 10000, 
  rateLimitDelay: number = 500
): Promise<User[]> {
  const allUsers: User[] = [];
  const numBatches: number = Math.ceil(totalUsers / batchSize);
  
  for (let batch = 0; batch < numBatches; batch++) {
    const offset: number = batch * batchSize;
    
    try {
      // Construct URL with current offset
      const url: string = `${baseUrl}&offset=${offset}`;
      
      // Make request with proper error handling
      const response = await axios.get(url);
      
      // Parse response
      const batchData = response.data;
      
      // Add users from this batch
      if (Array.isArray(batchData)) {
        allUsers.push(...batchData);

        // save this batch
        fs.writeFileSync(
          `./done/${offset}.json`, 
          JSON.stringify(batchData, null, 2), 
          { encoding: 'utf-8' }
        );
      } else {
        console.warn(`Warning: Unexpected response format at offset ${offset}`);
        continue;
      }
      
      // Progress update
      const usersSoFar: number = allUsers.length;
      console.log(`Fetched ${usersSoFar} users out of ${totalUsers}`);
      
      // Stop if we've reached the target number
      if (usersSoFar >= totalUsers) {
        break;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Error fetching batch at offset ${offset}: ${error.message}`);
      } else {
        console.error(`Unexpected error at offset ${offset}: ${error}`);
      }
      
      // Wait longer after an error before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }
  }
  
  // Trim to exact number requested
  return allUsers.slice(0, totalUsers);
}

/**
 * Saves the collected user data to a JSON file.
 * 
 * @param users - List of user data objects
 * @param outputFile - Output file path
 */
function saveUserData(users: User[], outputFile: string = "user_data.json"): void {
  const data: ResponseData = {
    total_users: users.length,
    timestamp: new Date().toISOString(),
    users: users
  };
  
  fs.writeFileSync(
    outputFile, 
    JSON.stringify(data, null, 2), 
    { encoding: 'utf-8' }
  );
  
  console.log(`Saved ${users.length} users to ${outputFile}`);
}

/**
 * Main execution function.
 */
async function main(): Promise<void> {
  // API configuration
  const BASE_URL: string = process.env.API_URL;
  const TOTAL_USERS: number = 100000;
  const BATCH_SIZE: number = 1000;
  const RATE_LIMIT_DELAY: number = 500; // 500ms between requests
  
  // Fetch data
  console.log(`Starting data collection for ${TOTAL_USERS} users...`);
  const users = await fetchUserData(BASE_URL, BATCH_SIZE, TOTAL_USERS, RATE_LIMIT_DELAY);
  
  // Save data
  if (users.length > 0) {
    saveUserData(users);
    console.log("Data collection completed successfully");
  } else {
    console.log("No data collected");
  }
}

// Execute main function and handle any unhandled promise rejections
main().catch(error => {
  console.error("Unhandled error in main execution:", error);
  process.exit(1);
});