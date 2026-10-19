# Prompt History

## Prompt 7: Delivery Location Bug Fix
```
There is a bug in the "Delivery Location" step of checkout. Both the manual search (Places Autocomplete) and the "Use My Current Location" (geolocation) options are visible and clickable, but the location that ends up being used is incorrect or is not actually saved. Fix this so that:

1. Whichever method the customer uses last (typing/selecting an address in Places Autocomplete, dragging the map pin, or clicking "Use My Current Location") is the one whose latitude/longitude/formatted address becomes the current confirmed location — the state holding the location must always reflect the most recent user action, with no stale or leftover values from a previous method.
2. When the customer selects an address from Places Autocomplete, the map pin must move to that exact location, and the stored latitude/longitude must match the coordinates of the selected place (not the map's default/initial center).
3. When the customer clicks "Use My Current Location", the browser geolocation coordinates must be the ones stored and shown — the map pin must move to that exact position, and any previously searched address must be cleared or clearly replaced.
4. If the customer manually drags the pin after using either method, the latitude/longitude must update to the pin's new dropped position, and the displayed address text should update to match (reverse geocode the dropped pin position).
5. The "Confirm Location" button must use the current state at the moment it is clicked, not a stale/cached value from an earlier render.
6. Log or display clearly (e.g. in a debug console.log during development) the final latitude, longitude, and formatted address being passed forward to the delivery service step, so this can be verified.
7. Confirm that this same, correctly-set latitude/longitude is what gets used for the distance calculation in the delivery service step (Restaurant Delivery / Grab pricing), and what gets saved on the final order.

Do not change the visual design of this step or any other part of the app — this is a bug fix only, focused on making the location state accurate and consistent across manual search, pin drag, and auto-detect.
```
