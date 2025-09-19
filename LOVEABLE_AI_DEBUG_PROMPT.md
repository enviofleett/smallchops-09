# AI Debugging Prompt for Order Status Update Errors

## Context
In our application, we have encountered issues related to the order status update feature. This feature is crucial for providing timely updates to users regarding their order status. The errors have been sporadic and are causing confusion among users.

## What to Debug
1. **Order Status Transition:** Check if the order status transitions correctly from pending to shipped and then to delivered. 
2. **Error Logging:** Review the logs for any errors that occur during the status update process.
3. **API Response:** Verify if the API responsible for handling order status updates is returning the expected responses.

## What to Surface
- Any discrepancies between the expected and actual order status updates.
- Errors or warnings logged during the update process.
- Response times from the API and whether they are within acceptable limits.

## Recommendations
- Implement additional logging around the order status update process to catch errors in real-time.
- Consider setting up alerts for when order status updates fail.
- Review the logic that handles the status updates to ensure there are no edge cases being overlooked.

## How to Reproduce the Error
1. Place an order in the system and wait for the status to change.
2. Trigger the order status update manually or through the system’s automated processes.
3. Observe if the order status updates correctly in the user interface.
4. Refer to the screenshots attached (image1 and image2) for visual evidence of the issue.

### Supporting Evidence
- **Screenshot 1:** image1 
- **Screenshot 2:** image2

This prompt aims to provide a structured approach to diagnosing and resolving order status update errors effectively.