# Fenced Code Blocks with Tildes

## Basic triple tilde fence

~~~
hello world
~~~
1  2            3
@1 FencedOpen
@2 FencedContent "\nhello world\n"
@3 FencedClose

## Triple tilde with language info

~~~python
print("hello")
~~~
1  2                        3
@1 FencedOpen
@2 FencedContent "python\nprint(\"hello\")\n"
@3 FencedClose