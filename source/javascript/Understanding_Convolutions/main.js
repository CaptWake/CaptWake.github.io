fetch('/data/Understanding_Convolutions/data.json')
    .then((response) => response.json())
    .then(
        (data) => {
            const ctx = document.getElementById('distribChart').getContext('2d');
            const gradientFill = ctx.createLinearGradient(0, 0, 0, 200);
            gradientFill.addColorStop(0, 'rgba(106, 90, 205, 0.8)'); // Start color (more distant)
            gradientFill.addColorStop(1, 'rgba(106, 90, 205, 0)');   // End color (transparent)
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({ length: 100 }, (_, index) => index -50),
                    datasets: [
                        {
                            label: 'X',
                            data: data.X,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 2,
                            fill: false,
                            pointRadius: 0,
                        },
                        {
                            label: 'Y',
                            data: [null, null, null, null].concat(data.Y),
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 2,
                            fill: false,
                            pointRadius: 0,
                        },
                        {
                            label: 'Z',
                            data: [null, null, null, null].concat(data.Z),
                            borderColor: 'rgb(106, 90, 205)',
                            borderWidth: 2,
                            fill: true,
                            backgroundColor: gradientFill,
                            pointRadius: 0,
                        },
                        
                    ],
                },
                options: {
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                        },
                        y: {
                            min: 0,
                        },
                    },
                },
            })
    });


fetch('/data/Understanding_Convolutions/signal_data.json')
    .then((response) => response.json())
    .then(
        (data) => {
            const ctx = document.getElementById('originalSignal').getContext('2d');
            const gradientFill = ctx.createLinearGradient(0, 0, 0, 200);
            gradientFill.addColorStop(0, 'rgba(106, 90, 205, 0.8)'); // Start color (more distant)
            gradientFill.addColorStop(1, 'rgba(106, 90, 205, 0)');   // End color (transparent)
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({ length: 2500 }, (_, index) => index + 1),
                    datasets: [
                        {
                            label: 'original',
                            data: data.original_signal,
                            borderColor: 'rgba(75, 192, 192, 0.5)',
                            borderWidth: 2,
                            fill: false,
                            pointRadius: 0,
                        },
                        {
                            label: 'filtered',
                            data: data.filtered,
                            borderColor: 'rgb(255, 0, 0)',
                            borderWidth: 2,
                            fill: false,
                            pointRadius: 0,
                        },
                    ],
                },
                options: {
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                        }
                    },
                },
            })
    });

fetch('/data/Understanding_Convolutions/spectrum_data.json')
    .then((response) => response.json())
    .then(
        (data) => {
            const ctx = document.getElementById('spectrum').getContext('2d');
            const gradientFill = ctx.createLinearGradient(0, 0, 0, 200);
            gradientFill.addColorStop(0, 'rgba(106, 90, 205, 0.8)'); // Start color (more distant)
            gradientFill.addColorStop(1, 'rgba(106, 90, 205, 0)');   // End color (transparent)
            console.log(data)
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.x_original.slice(2, -1),
                    datasets: [
                        {
                            label: 'original',
                            data: data.y_original.slice(2, -1),
                            borderColor: 'rgba(75, 192, 192, 0.5)',
                            borderWidth: 2,
                            fill: false,
                            pointRadius: 0,
                        },
                        {
                            label: 'filtered',
                            data: data.y_filtered.slice(2, -1),
                            borderColor: 'rgb(255, 0, 0)',
                            borderWidth: 2,
                            fill: false,
                            pointRadius: 0,
                        },
                    ],
                },
                options: {
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                        }
                    },
                },
            })
    });