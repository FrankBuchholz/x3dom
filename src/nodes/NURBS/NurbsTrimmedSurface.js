/** @namespace x3dom.nodeTypes */
/*
 * X3DOM JavaScript Library
 * http://www.x3dom.org
 *
 * (C)2018 A. Plesch, Waltham, MA USA
 * Dual licensed under the MIT and GPL
 */
 /*
 * Ayam, a free 3D modeler for the RenderMan interface.
 *
 * Ayam is copyrighted 1998-2016 by Randolf Schultz
 * (randolf.schultz@gmail.com) and others.
 *
 * All rights reserved.
 *
 * See the file License for details.
 *
 */

/* ### NurbsTrimmedSurface ### */
x3dom.registerNodeType(
    "NurbsTrimmedSurface",
    "NURBS",
    defineClass(x3dom.nodeTypes.NurbsPatchSurface, //X3DNurbsSurfaceGeometryNode
        
        /**
         * Constructor for NurbsTrimmedSurface
         * @constructs x3dom.nodeTypes.NurbsTrimmedSurface
         * @x3d 3.3
         * @component NURBS
         * @status experimental
         * @extends x3dom.nodeTypes.NurbsPatchSurface //X3DNurbsSurfaceGeometryNode
         * @param {Object} [ctx=null] - context object, containing initial settings like namespace
         * @classdesc The NurbsTrimmedSurface node defines a NURBS surface that is trimmed by a set of trimming loops.
         */
         
        function (ctx) {
            x3dom.nodeTypes.NurbsTrimmedSurface.superClass.call(this, ctx);
            
            /**
             * The trimmingContour field, if specified, shall contain a set of Contour2D nodes. Trimming loops shall be processed
             * as described for the Contour2D node. If no trimming contours are defined, the NurbsTrimmedSurface node shall have
             * the same semantics as the NurbsPatchSurface node.
             * @var {x3dom.fields.MFNode} trimmingContour
             * @memberof x3dom.nodeTypes.NurbsTrimmedSurface
             * @initvalue []
             * @field x3d
             * @instance
             */
            this.addField_MFNode('trimmingContour', x3dom.nodeTypes.Contour2D);
            
            this._needReRender = true;
	          this._myctx = ctx;
        },
        {
            nodeChanged: function() {
                this._needReRender = true;
                this._vf.ccw = false;
                this._vf.solid = false;
                this._vf.useGeoCache = false;
                if(!this._hasCoarseMesh){
                    var its = x3dom.nodeTypes.NurbsTrimmedSurface.prototype.createCoarseITS(this);
                    this._mesh = its._mesh;
                    this._hasCoarseMesh = true;
                }

                var x3de = this._myctx.doc._x3dElem;
                tessProgress(x3de, true);

                var T = [];
                if(this._cf.trimmingContour &&
                   this._cf.trimmingContour.nodes.length) {
                    var len = this._cf.trimmingContour.nodes.length;
                    for(var i = 0; i < len; i++) {
                  var c2dnode = this._cf.trimmingContour.nodes[i];
                  if(c2dnode._cf.children) {
                      T[i] = [];
                      var trim = c2dnode._cf.children.nodes;
                      for(var j = 0; j < trim.length; j++) {
                    var tc = trim[j];
                    // convert polyline to NURBS
                    if(!tc._vf.order) {
                        tc._vf.order = 2;
                    }
                    if(!tc._vf.knot) {
                        var knots = [];
                        knots.push(0);
                        knots.push(0);
                        for(var k = 2;
                      k < tc._vf.controlPoint.length; k++) //controlPoint.length when MFVec2f, was /2
                      knots.push(k-1);
                        knots.push(knots[knots.length-1]+1);
                        knots.push(knots[knots.length-1]);
                        tc._vf.knot = knots;
                    }
                    T[i].push([tc._vf.controlPoint.length-1, //T[0] needs attention when MFVec2f
                         tc._vf.order-1, tc._vf.knot,
                         tc._vf.controlPoint, tc._vf.weight]); //T[3] needs attention when MFVec2f
                      }
                  }
                    }
                }

                var onmessage = function(e) {
                    if(e.data.length >= 3){
                  var its = createITS(e.data, this.caller);
                  this.caller.workerTask = null;
                  this.caller._mesh = its._mesh;
                  if(this.caller._cleanupGLObjects)
                      this.caller._cleanupGLObjects(true);
                  Array.forEach(this.caller._parentNodes,
                          function (node) {
                        node.setAllDirty();
                          });
                  if(tessWorkerPool.taskQueue.length == 0) {
                      var x3de = this.caller._myctx.doc._x3dElem;
                      tessProgress(x3de, false);
                  }
                  this.caller._nameSpace.doc.needRender = true;
                    }
                }
                var coordNode = this._cf.controlPoint.node;
                x3dom.debug.assert(coordNode);
                var startmessage = [this._vf.uDimension-1,
                        this._vf.vDimension-1,
                        this._vf.uOrder-1, this._vf.vOrder-1,
                        this._vf.uKnot, this._vf.vKnot,
                        coordNode.getPoints(),
                        this._vf.weight,
                        this._vf.uTessellation,
                        this._vf.vTessellation,
                        T];

                if(this.workerTask)
                    this.workerTask.discard = true;

                this.workerTask = new WorkerTask('https://rawgit.com/andreasplesch/x3dom/Nurbs/src/nodes/NURBS/x3dom-nurbs-worker.js',
                         this, onmessage, startmessage);

                tessWorkerPool.addWorkerTask(this.workerTask);
            },
            fieldChanged: function(fieldName) {
		            this.nodeChanged();
            },
            createCoarseITS: function(node) {
                var w = node._vf.uDimension;
                var h = node._vf.vDimension;
                var coordNode = node._cf.controlPoint.node;

                var its = new x3dom.nodeTypes.IndexedTriangleSet();
                its._nameSpace = node._nameSpace;
                its._vf.solid = false;
                its._vf.ccw = false;
                var ind = [], i1 = 0, i2 = w;
                for(var i = 0; i < h-1; i++){
                for(var j = 0; j < w-1; j++){
                    ind.push(i1);
                    ind.push(i1+1);
                    ind.push(i2);
                    ind.push(i2);
                    ind.push(i1+1);
                    ind.push(i2+1);
                    i1++;
                    i2++;
                }
                i1++;
                i2++;
                }
                its._vf.index = ind;

                its.addChild(coordNode)
                if(0){
                var tc = new x3dom.nodeTypes.TextureCoordinate();
                tc._nameSpace = node._nameSpace;
                tc._vf.point = new x3dom.fields.MFVec2f(data[2]/*tess.texcoords*/);
                its.addChild(tc)
                }

                its.nodeChanged();
                its._xmlNode = node._xmlNode;
                return its;
            } /* createCoarseITS */
        }
    )
);
