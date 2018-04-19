var loc = document.location.href;
var urlSplit = loc.split('/');
urlSplit.pop();
var group = urlSplit.pop();

var botonSankey = document.createElement('input');
botonSankey.type = 'button';
botonSankey.id = 'botonSankey';
botonSankey.value = 'Gráfico Alluvial';
botonSankey.title = "Puntuaciones por ejercicio";
botonSankey.onclick = function() {obtenerAnotacionesSankey()};

var botonScatter = document.createElement('input');
botonScatter.type = 'button';
botonScatter.id = 'botonScatter';
botonScatter.value = 'Gráfico de dispersión';
botonScatter.title = "Notas por examen";
botonScatter.onclick = function() {obtenerAnotacionesScatter()};
//document.getElementsByClassName('search-results__total')[0].appendChild(document.createElement("br"));
document.getElementsByClassName('search-results__total')[0].appendChild(botonSankey);
document.getElementsByClassName('search-results__total')[0].appendChild(botonScatter);

var anotaciones;
//Mediante Ajax obtenemos como maximo las primeras 200 anotaciones (200 es el limite que podemos obtener en una llamada)
var xhttp = new XMLHttpRequest();
xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
        anotaciones= JSON.parse(this.responseText);
    }
};
xhttp.open("GET", "https://hypothes.is/api/search?group="+group+"&limit=200", false);
xhttp.setRequestHeader("Authorization", "Bearer 6879-Q--ve1yLCItODnHueg4py6UT-qqq93bk-xgvra0-BVA");
xhttp.send();

var numAnotacionesTotal= anotaciones.total; //Anotaciones totales
var numAnotacionesAcumuladas= anotaciones.rows.length; //Anotaciones obtenidas en la primera llamada
var anotaciones=anotaciones.rows; //Nos quedamos solo con las anotaciones (Quitamos el total)
while (numAnotacionesTotal!=numAnotacionesAcumuladas){
    var offset=numAnotacionesAcumuladas; //Numero de anotaciones a ignorar
    obtenerAnotacionesAjax(offset);
}

//Funcion que obtiene las anotaciones (como maximo 200) ignorando las primeras n anotaciones (offset)
function obtenerAnotacionesAjax(offset){
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var anotacionesResto= JSON.parse(this.responseText);
            anotaciones=anotaciones.concat(anotacionesResto.rows); //Añadimos las nuevas anotaciones a las que teniamos
            numAnotacionesAcumuladas=numAnotacionesAcumuladas+anotacionesResto.rows.length; //Actualizamos el numero de anotaciones obtenidas hasta el momento
        }
    };
    xhttp.open("GET", "https://hypothes.is/api/search?group="+group+"&offset="+offset+"&limit=200", false);
    xhttp.setRequestHeader("Authorization", "Bearer 6879-Q--ve1yLCItODnHueg4py6UT-qqq93bk-xgvra0-BVA");
    xhttp.send();
}

//Devuelve TRUE si el array de tags tiene longitud 2 y la primera es la pregunta y la segunda la nota
function filtradoTags(tags) {
    return (tags.length==2) && tags[0].includes("isCriteriaOf") && tags[1].includes("mark");
}

/////////////////// Funciones para crear el diagrama de dispersion ////////////////////////

function obtenerAnotacionesScatter() {
    // Filtramos las anotaciones para obtener solo las que tienen 2 tags -> "isCriteriaOf" y "mark"
    var anotFiltradas = _.filter(anotaciones, (anotacion) => (filtradoTags(anotacion.tags)));

//A raiz de las anotaciones creamos una lista de objetos que contienen la uri del alumno, una pregunta y la nota obtenida. Pueden existir objetos repetidos ya que para varias preguntas existen varias anotaciones
    var preguntasAlumnosRep = _.map(anotFiltradas, (anotacion) => ({
        'uri': anotacion.uri,
        'pregunta': anotacion.tags[0].split(':').pop(),
        'nota': parseInt(anotacion.tags[1].split(':').pop())
    }));
//Filtramos la lista previamente obtenida para eliminar los objetos repetidos
    var preguntasAlumnos = _.uniqBy(preguntasAlumnosRep, (alumno) =>(alumno.uri.concat(alumno.pregunta)));

//Creamos una lista y añadimos a cada alumno y su nota media. La nota media la pasamos sobre 10.
    var notasMedias = _(preguntasAlumnos).groupBy('uri')
        .map((preguntas, alumno) => ({
            'uri': alumno,
            'notaMedia': normalizar(_.sumBy(preguntas, 'nota'))
        })).value();

//Agrupamos a los alumnos por su nota media
    var datos = _(notasMedias).countBy("notaMedia")
        .map((count, nota) => ({
            'examen': "XML Schema",
            'notaMedia': parseFloat(nota),
            'numAlumnos': count
        })).value();

     dibujarScatterPlot(datos);
}


//Dada una nota lo pasa sobre 10 (actualmente solo funciona para examenes que valen 2.5)
function normalizar (nota) { return (nota*10)/250; }


function dibujarScatterPlot(datos){
        //Margenes
        var margins = {
            "left": 40,
            "right": 35,
            "top": 35,
            "bottom": 30
        };

        //Dimensiones
        var width = 550;
        var height = 500;

        var x = d3.scale.ordinal() //Escala del eje x
            .rangeRoundPoints([0, width - margins.left - margins.right], 1)
            .domain(datos.map(function(d) { return d.examen; }));

        var y = d3.scale.linear()  //Escala del eje Y
            .domain(d3.extent(datos, function (d) {
                return d.notaMedia;
            }))
            .range([height - margins.top - margins.bottom, 0]).nice();

        var r= d3.scale.linear() //Escala del radio
            .domain([1, d3.max(datos, function(d) { return d.numAlumnos; })])
            .range([5, 25]);

        //Ejes
        var xAxis = d3.svg.axis().scale(x).orient("bottom").tickPadding(2);
        var yAxis = d3.svg.axis().scale(y).orient("left").tickPadding(2);

        d3.select("#svg").remove(); //Eliminar el SVG si lo hubiera

        var svg = d3.select(".search-results__total") // Crear e insertar el SGV
            .append("svg")
            .attr("id", "svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", "translate(" + margins.left + "," + margins.top + ")");

        var tooltip = d3.tip() //Creacion del tooltip
            .attr('class', 'd3tip')
            .offset([-10, 0])
            .html(function(d) {
                return "Nota "+d.notaMedia+": <br><strong>" + d.numAlumnos+" Alumnos</strong>"; //Mensaje del tooltip
            });

        svg.call(tooltip);

        //Eje X
        svg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0," + y.range()[0] + ")")
            .call(xAxis)
            .append("text")
            .attr("class", "label")
            .attr("x", width- margins.left - margins.right)
            .attr("y", -6)
            .style("text-anchor", "end")
            .text("Examenes");

        //Eje Y
        svg.append("g")
            .attr("class", "axis")
            .call(yAxis)
            .append("text")
            .attr("class", "label")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Nota");

        //Añadir los puntos
        svg.selectAll("dot")
            .data(datos)
            .enter().append("circle")
            .attr("r", function(d) { return r(d.numAlumnos);  })
            .attr("cx", function(d) { return x(d.examen);})
            .attr("cy", function(d) { return y(d.notaMedia); })
            .style("fill", function(d) {
                if (d.notaMedia<3.0) {return "#ef5a3c";}
                else if ((d.notaMedia>=3.0) && (d.notaMedia<5.0)){
                    return "#ee8c2b";
                } else if ((d.notaMedia>=5.0) && (d.notaMedia<7.0)) {
                    return "#f1e738";
                } else if ((d.notaMedia>=7.0) && (d.notaMedia<9.0)){
                    return "#7bee22";
                } else {return "#24ee34"; }
            })
            .on('mouseover', tooltip.show) //Al pasar por encima de una barra aparece el tooltip
            .on('mouseout', tooltip.hide);

    }



/////////////////// Funciones para crear el diagrama Alluvial ////////////////////////

function obtenerAnotacionesSankey(group) {
        //Eliminamos las anotaciones de una pregunta de un alumno repetidas
        var anotacionesUnicas = _.uniqBy(anotaciones, e => (e.uri.concat(e.tags[0])));

        //Nos quedamos solo con los tags de cada anotacion
        var tags = _.map(anotacionesUnicas, 'tags')

        // Filtramos los tags para obtener solo las que tienen 2 tags -> "isCriteriaOf" y "mark"
        var tagsFiltrados = tags.filter(filtradoTags);

        //Agrupamos los tags y a continuacion creamos los enlaces cuyo origen sera la pregunta, el objetivo la puntuacion y el valor cuantos hay
        var enlaces = _.values(_.groupBy(tagsFiltrados)).map(d => ({
            source: d[0][0].split(':').pop(),
            target: d[0][1].split(':').pop(),
            value: d.length
        }));

        //Creamos una lista con los nombres de los nodos (preguntas y puntuaciones)
        var nodos = _.values(_.groupBy(_.flatten(tagsFiltrados))).map(d => ({name: d[0].split(':').pop()}));

        //Creamos un objeto con los nodos y los enlaces
        var graph = {nodes: nodos, links: enlaces};

        dibujarGraficoSankey(graph);
}


    //Funcion que dibuja el grafico Sankey/Alluvial
    function dibujarGraficoSankey(graph){
        var units = "Alumnos"; //Unidad/valor de la anchura de las lineas

        //Margenes, altura y anchura
        var margin = {top: 10, right: 10, bottom: 10, left: 10},
            width = 850 - margin.left - margin.right,
            height = 600 - margin.top - margin.bottom;

        var formatNumber = d3.format(",.0f"),    // Elimina los decimales
            format = function(d) { return formatNumber(d) + " " + units; }, //Dado un numero le da un formato
            color = d3.scale.category20(); //Da acceso a una escala de colores

        // Insertamos el SGV y establecemos sus medidas

        d3.select("#svg").remove();
        var svg = d3.select(".search-results__total")
            .append("svg")
            .attr("id", "svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")"); //Posicion donde se va a situar

        // Establecemos las propiedades del grafico Sankey (anchura de nodos, distancia entre nodos y dimensiones del diagrama)
        var sankey = d3.sankey()
            .nodeWidth(12)
            .nodePadding(25)
            .size([width, height]);

        var path = sankey.link(); //un puntero a la función de sankey que hace que los enlaces entre los nodos se curven. en los lugares correctos.

        // Cargamos los datos obtenidos previamente para su posterior visualizacion
        (function(graph) {

            //Este codigo es debido a que se han utilizado los nombres de los nodos en el source y target de los links -> https://stackoverflow.com/questions/14629853/json-representation-for-d3-force-directed-networks
            var nodeMap = {};
            graph.nodes.forEach(function(x) { nodeMap[x.name] = x; });
            console.log('graph', graph);
            var graph2=graph;
            graph.links = graph.links.map(function(x) {
                return {
                    source: nodeMap[x.source],
                    target: nodeMap[x.target],
                    value: x.value
                };});


            sankey
                .nodes(graph.nodes)
                .links(graph.links)
                .layout(12);

            // Añadimos los enlaces (links) en el diagrama
            var link = svg.append("g").selectAll(".link")
                .data(graph.links)
                .enter().append("path")
                .attr("class", "link")
                .attr("d", path)
                .style("stroke-width", function(d) { return Math.max(1, d.dy); })
                .sort(function(a, b) { return b.dy - a.dy; });

            // Añade un mensaje de texto que aparece al pasar el raton por encima de los enlaces (indica el origen, el destino y el valor)
            link.append("title")
                .text(function(d) {
                    return d.source.name + " → " +
                        d.target.name + "\n" + format(d.value);
                });


            // Añade los nodos (no los rectangulos ni el texto)
            var node = svg.append("g").selectAll(".node")
                .data(graph.nodes)
                .enter().append("g")
                .attr("class", "node")
                .attr("transform", function(d) {
                    return "translate(" + d.x + "," + d.y + ")"; })
                .call(d3.behavior.drag()
                    .origin(function(d) { return d; })
                    .on("dragstart", function() {
                        this.parentNode.appendChild(this); })
                    .on("drag", dragmove));

            // Añadir los rectangulos a los nodos
            node.append("rect")
                .attr("height", (d) => d.dy)
                .attr("width", sankey.nodeWidth())
                .style("fill", function(d) {
                    return d.color = color(d.name.replace(/ .*/, "")); })
                .style("stroke", function(d) {
                    return d3.rgb(d.color).darker(2); })
                .append("title")
                .text(function(d) {
                    return d.name + "\n" + format(d.value); });

            // Añadir titulo a los nodos
            node.append("text")
                .attr("x", -6)
                .attr("y", (d) => d.dy / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "end")
                .attr("transform", null)
                .text((d) => d.name)
                .filter((d) =>d.x < width / 2)
                .attr("x", 6 + sankey.nodeWidth())
                .attr("text-anchor", "start");

            // Funcion para mover los nodos
            function dragmove(d) {
                d3.select(this).attr("transform",
                    "translate(" + (
                        d.x = Math.max(0, Math.min(width - d.dx, d3.event.x))
                    ) + "," + (
                        d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))
                    ) + ")");
                sankey.relayout();
                link.attr("d", path);
            }

        })(graph);
    }
