// Initialize TimePicker for start and end time inputs
document.addEventListener('DOMContentLoaded', () => {
    var startTimePicker = new TimePicker('start-time', {
        lang: 'en',
        theme: 'dark'
    });
    startTimePicker.on('change', function(evt) {
        var value = (evt.hour || '00') + ':' + (evt.minute || '00');
        evt.element.value = value;
    });

    var endTimePicker = new TimePicker('end-time', {
        lang: 'en',
        theme: 'dark'
    });
    endTimePicker.on('change', function(evt) {
        var value = (evt.hour || '00') + ':' + (evt.minute || '00');
        evt.element.value = value;
    });

    // Handle form submission
    const form = document.getElementById('overtime-form');
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent default form submission

        const startTimeStr = document.getElementById('start-time').value;
        const endTimeStr = document.getElementById('end-time').value;
        const breakTimeMinutes = parseInt(document.getElementById('break-time').value);
        const requiredWorkTimeStr = document.getElementById('required-work-time').value;
        const currentOvertimeMinutes = parseInt(document.getElementById('current-overtime').value);

        const resultDiv = document.getElementById('result');
        resultDiv.innerHTML = ''; // Clear previous results

        // Input validation
        if (!startTimeStr || !endTimeStr || isNaN(breakTimeMinutes) || !requiredWorkTimeStr || isNaN(currentOvertimeMinutes)) {
            resultDiv.innerHTML = '<p class="error">Please fill in all fields correctly.</p>';
            return;
        }

        // Parse times into minutes
        const parseTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                return null; // Indicate invalid time format
            }
            return hours * 60 + minutes;
        };

        const startTimeMinutes = parseTime(startTimeStr);
        const endTimeMinutes = parseTime(endTimeStr);
        const requiredWorkTimeTotalMinutes = parseTime(requiredWorkTimeStr);

        if (startTimeMinutes === null || endTimeMinutes === null || requiredWorkTimeTotalMinutes === null) {
            resultDiv.innerHTML = '<p class="error">Please enter times in HH:MM format (e.g., 08:30).</p>';
            return;
        }

        // Calculate daily working time
        let dailyWorkMinutes = endTimeMinutes - startTimeMinutes - breakTimeMinutes;

        // Handle overnight shifts (if end time is earlier than start time, assume it's the next day)
        if (dailyWorkMinutes < 0) {
            dailyWorkMinutes += (24 * 60); // Add a full day in minutes
        }

        // Calculate daily overtime/undertime
        const dailyOvertimeMinutes = dailyWorkMinutes - requiredWorkTimeTotalMinutes;

        // Calculate new total overtime
        const newTotalOvertimeMinutes = currentOvertimeMinutes + dailyOvertimeMinutes;

        // Calculate target leave time for neutral daily overtime (i.e., hitting required hours)
        const targetLeaveTimeMinutes = startTimeMinutes + requiredWorkTimeTotalMinutes + breakTimeMinutes;

        // Format minutes back to HH:MM
        const formatMinutesToHHMM = (totalMinutes) => {
            const sign = totalMinutes < 0 ? '-' : '';
            totalMinutes = Math.abs(totalMinutes);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        };

        const formatTimeToHHMM = (totalMinutes) => {
            let hours = Math.floor(totalMinutes / 60);
            let minutes = totalMinutes % 60;

            // Handle times that spill over 24 hours (e.g., 25:30 -> 01:30 next day)
            // For display purposes, we might want to show actual time or indicate next day
            // For simplicity, let's keep it within 24 hours for display unless otherwise specified
            hours = hours % 24; 

            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        };


        // Display results
        let dailyOvertimeStatus = '';
        if (dailyOvertimeMinutes > 0) {
            dailyOvertimeStatus = `+${formatMinutesToHHMM(dailyOvertimeMinutes)}`;
        } else {
            dailyOvertimeStatus = formatMinutesToHHMM(dailyOvertimeMinutes);
        }

        let newTotalOvertimeStatus = '';
        if (newTotalOvertimeMinutes > 0) {
            newTotalOvertimeStatus = `+${formatMinutesToHHMM(newTotalOvertimeMinutes)}`;
        } else {
            newTotalOvertimeStatus = formatMinutesToHHMM(newTotalOvertimeMinutes);
        }


        resultDiv.innerHTML = `
            <h3>Calculation Results:</h3>
            <p><strong>Daily Working Time:</strong> ${formatMinutesToHHMM(dailyWorkMinutes)}</p>
            <p><strong>Daily Overtime/Undertime:</strong> ${dailyOvertimeStatus}</p>
            <p><strong>New Total Overtime:</strong> ${newTotalOvertimeStatus}</p>
            <p><strong>To hit your required daily hours, you should leave at:</strong> ${formatTimeToHHMM(targetLeaveTimeMinutes)}</p>
        `;

        if (dailyOvertimeMinutes < 0) {
            resultDiv.innerHTML += `<p class="warning">You made ${formatMinutesToHHMM(dailyOvertimeMinutes)} minus time today.</p>`;
        }
    });
});