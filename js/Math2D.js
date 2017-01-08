var Math2D = {

    // Determines the (x,y) point where two line segments [(x1,y1),(x2,y2)] and [(x3,y3),(x4,y4)] intersect.
    lineIntersect: function (x1, y1, x2, y2, x3, y3, x4, y4) {
        "use strict";
        var x =
		    ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) /
		    ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));

        var y =
		    ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) /
		    ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));

        var pointOfIntersection = {
            x: 0, y: 0
        };

        if (isNaN(x) || isNaN(y)) {
            return pointOfIntersection;
        }

        if (x1 >= x2) {
            if (!(x2 <= x && x <= x1)) { return pointOfIntersection; }
        }
        else {
            if (!(x1 <= x && x <= x2)) { return pointOfIntersection; }
        }

        if (y1 >= y2) {
            if (!(y2 <= y && y <= y1)) { return pointOfIntersection; }
        }
        else {
            if (!(y1 <= y && y <= y2)) { return pointOfIntersection; }
        }

        if (x3 >= x4) {
            if (!(x4 <= x && x <= x3)) { return pointOfIntersection; }
        }
        else {
            if (!(x3 <= x && x <= x4)) { return pointOfIntersection; }
        }

        if (y3 >= y4) {
            if (!(y4 <= y && y <= y3)) { return pointOfIntersection; }
        }
        else {
            if (!(y3 <= y && y <= y4)) { return pointOfIntersection; }
        }

        pointOfIntersection.x = x;
        pointOfIntersection.y = y;

        return pointOfIntersection;
    },

    // Determines if the given point is outside, inside, or directly on a circle.
    pointInRelationToCircle: function (pX, pY, cX, cY, r) {
        "use strict";
        var result,
            distance = (((pX - cX) * (pX - cX)) + ((pY - cY) * (pY - cY))),
            radiusSquared = r * r;
        if (distance < radiusSquared) {
            result = 1; // inside the circle.
        }
        else if (distance === radiusSquared) {
            result = 0; // directly on the circle.
        }
        else if (distance > radiusSquared) {
            result = -1; // outside the circle.
        }
        else {
            var errorMsg = "Invalid point and circle collision check.";
            errorMsg += "\r\npX: " + pX;
            errorMsg += "\r\npY: " + pY;
            errorMsg += "\r\ncX: " + cX;
            errorMsg += "\r\ncY: " + cY;
            errorMsg += "\r\nr: " + r;
            throw new Error(errorMsg);
        }
        return result;
    },
    
    intersectionRectanglePointSimple: function (shape, point) {
        //(x1 <= x <= x2) and (y1 <= y <= y2)
        return (
            (shape.x <= point.x && point.x <= shape.x + shape.width) &&
            (shape.y <= point.y && point.y <= shape.y + shape.height)
            );
    },

    // Determines if two rectangles intersect.
    intersectionRectanglesSimple: function (shapeA, shapeB) {
        "use strict";
        var simpleIntersectionResult = false;

        // Get the midpoint coordinates:
        var midXA = shapeA.x + (shapeA.width / 2);
        var midXB = shapeB.x + (shapeB.width / 2);
        var midYA = shapeA.y + (shapeA.height / 2);
        var midYB = shapeB.y + (shapeB.height / 2);

        // Get the vectors to check against:
        var vX = (midXA - midXB);
        var vY = (midYA - midYB);

        // Add the half widths and half heights of the objects
        var hWidths = (shapeA.width / 2) + (shapeB.width / 2);
        var hHeights = (shapeA.height / 2) + (shapeB.height / 2);

        simpleIntersectionResult = (Math.abs(vX) <= hWidths && Math.abs(vY) <= hHeights);
        return simpleIntersectionResult;
    }


    //function LinesIntersect(l1p1, l1p2, l2p1, l2p2) {
    //    "use strict";
    //    var q = (l1p1.Y - l2p1.Y) * (l2p2.X - l2p1.X) - (l1p1.X - l2p1.X) * (l2p2.Y - l2p1.Y);
    //    var d = (l1p2.X - l1p1.X) * (l2p2.Y - l2p1.Y) - (l1p2.Y - l1p1.Y) * (l2p2.X - l2p1.X);
    //    if (d == 0) {
    //        return false;
    //    }
    //    var r = q / d;
    //    q = (l1p1.Y - l2p1.Y) * (l1p2.X - l1p1.X) - (l1p1.X - l2p1.X) * (l1p2.Y - l1p1.Y);
    //    var s = q / d;
    //    if (r < 0 || r > 1 || s < 0 || s > 1) {
    //        return false;
    //    }
    //    return true;
    //}

};