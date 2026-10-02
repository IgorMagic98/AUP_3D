class Node_new extends THREE.Mesh
{
    constructor( geometry, material, type) 
        {
            super( geometry, material)
            this.type=type
        }
}