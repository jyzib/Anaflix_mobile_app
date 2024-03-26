window.addEventListener('load', () => {
    setTimeout(() => {
        const mainData = document.querySelector('page-core-courses-dashboard')
        console.clear()
        const siteName = 'anaflix'
        mainData.innerHTML = `<h1>${siteName}</h1>`
        console.log(mainData)
        console.log('jazib')
    }, 9000)

})
